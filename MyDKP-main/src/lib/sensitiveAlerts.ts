import { prisma } from '@/lib/prisma';
import { isSensitiveAlertEnabled, matchSensitiveKeywords } from '@/lib/sensitiveKeywords';
import { sendMail } from '@/lib/mailer';
import { renderEmailTemplate } from '@/lib/emailTemplates';

type SensitiveSourceType = 'player_name' | 'log_reason';

export type SensitiveAlertInput = {
  sourceType: SensitiveSourceType;
  content: string;
  teamId?: string | null;
  sourceId?: string | null;
  playerId?: string | null;
  playerName?: string | null;
};

type DispatchResult = {
  scanned: number;
  claimed: number;
  sent: number;
  failed: number;
};

type ParsedAlert = {
  id: string;
  teamId: string | null;
  sourceType: string;
  sourceId: string | null;
  playerId: string | null;
  playerName: string | null;
  content: string;
  matchedKeywords: string[];
  attemptCount: number;
  createdAt: Date;
};

type EnrichedParsedAlert = ParsedAlert & {
  teamName: string | null;
  operatorName: string | null;
};

const MAX_ATTEMPTS_DEFAULT = 5;
const DISPATCH_BATCH_SIZE_DEFAULT = 50;
const RETRY_INTERVAL_SECONDS_DEFAULT = 300;

function toBool(value: string | undefined, defaultValue = false) {
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function getDispatchBatchSize() {
  const value = Number(process.env.SENSITIVE_ALERT_BATCH_SIZE || DISPATCH_BATCH_SIZE_DEFAULT);
  if (!Number.isFinite(value) || value <= 0) return DISPATCH_BATCH_SIZE_DEFAULT;
  return Math.floor(value);
}

function getRetryIntervalSeconds() {
  const value = Number(process.env.SENSITIVE_ALERT_RETRY_INTERVAL_SECONDS || RETRY_INTERVAL_SECONDS_DEFAULT);
  if (!Number.isFinite(value) || value < 0) return RETRY_INTERVAL_SECONDS_DEFAULT;
  return Math.floor(value);
}

function getMaxAttempts() {
  const value = Number(process.env.SENSITIVE_ALERT_MAX_ATTEMPTS || MAX_ATTEMPTS_DEFAULT);
  if (!Number.isFinite(value) || value <= 0) return MAX_ATTEMPTS_DEFAULT;
  return Math.floor(value);
}

function getRecipients() {
  return (process.env.SENSITIVE_ALERT_RECIPIENTS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldSendMail() {
  return toBool(process.env.SENSITIVE_ALERT_MAIL_ENABLED, false);
}

function serializeMatchedKeywords(keywords: string[]) {
  return JSON.stringify([...new Set(keywords)].slice(0, 200));
}

function parseMatchedKeywords(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item)).filter(Boolean);
  } catch (error) {
    return [];
  }
}

async function enrichAlertsForMail(alerts: ParsedAlert[]): Promise<EnrichedParsedAlert[]> {
  if (alerts.length === 0) return [];

  const teamIds = [...new Set(alerts.map((item) => item.teamId).filter((id): id is string => !!id))];
  const logIds = [
    ...new Set(
      alerts
        .filter((item) => item.sourceType === 'log_reason' && !!item.sourceId)
        .map((item) => item.sourceId as string),
    ),
  ];

  const [teams, logs] = await Promise.all([
    teamIds.length > 0
      ? prisma.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    logIds.length > 0
      ? prisma.dkpLog.findMany({
          where: { id: { in: logIds } },
          select: { id: true, operator: true },
        })
      : Promise.resolve([]),
  ]);

  const teamNameById = new Map(teams.map((item) => [item.id, item.name]));
  const operatorByLogId = new Map(logs.map((item) => [item.id, item.operator || '']));

  return alerts.map((alert) => ({
    ...alert,
    teamName: alert.teamId ? teamNameById.get(alert.teamId) || null : null,
    operatorName:
      alert.sourceType === 'log_reason' && alert.sourceId
        ? operatorByLogId.get(alert.sourceId) || null
        : null,
  }));
}

function buildAlertRecordsText(alerts: EnrichedParsedAlert[]) {
  const sortedAlerts = [...alerts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lines: string[] = [];

  for (let index = 0; index < sortedAlerts.length; index++) {
    const alert = sortedAlerts[index];
    lines.push(`----- #${index + 1} -----`);
    lines.push(`Alert ID: ${alert.id}`);
    lines.push(`Created At: ${alert.createdAt.toISOString()}`);
    lines.push(`Team Name: ${alert.teamName || 'N/A'}`);
    lines.push(`Operator: ${alert.operatorName || 'N/A'}`);
    lines.push(`Source Type: ${alert.sourceType}`);
    lines.push(`Player Name: ${alert.playerName || 'N/A'}`);
    lines.push(`Matched Keywords: ${alert.matchedKeywords.join(', ') || 'N/A'}`);
    lines.push('Content:');
    lines.push(alert.content || '(empty)');
    lines.push('');
  }

  return lines.join('\n').trim();
}

async function sendAlertMail(alerts: EnrichedParsedAlert[]) {
  if (alerts.length === 0) return;
  const recipients = getRecipients();
  if (recipients.length === 0) {
    throw new Error('Missing SENSITIVE_ALERT_RECIPIENTS.');
  }

  const sortedAlerts = [...alerts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = sortedAlerts[0];
  const last = sortedAlerts[sortedAlerts.length - 1];
  const sourceTypes = [...new Set(sortedAlerts.map((item) => item.sourceType))];
  const teamCount = new Set(sortedAlerts.map((item) => item.teamName || item.teamId || 'unknown')).size;
  const records = buildAlertRecordsText(sortedAlerts);

  const fallback = {
    subject: `[MyDKP Sensitive Alert] ${sortedAlerts.length} records (teams:${teamCount})`,
    bodyText: [
      'Sensitive content detected in MyDKP.',
      '',
      `Batch Count: ${sortedAlerts.length}`,
      `Time Range: ${first.createdAt.toISOString()} ~ ${last.createdAt.toISOString()}`,
      `Source Types: ${sourceTypes.join(', ')}`,
      '',
      records,
    ].join('\n'),
  };

  const rendered = await renderEmailTemplate(
    'sensitive_alert_summary',
    {
      batchCount: sortedAlerts.length,
      teamCount,
      timeRange: `${first.createdAt.toISOString()} ~ ${last.createdAt.toISOString()}`,
      sourceTypes: sourceTypes.join(', '),
      records,
    },
    fallback,
  );

  await sendMail({
    to: recipients,
    subject: rendered.subject,
    text: rendered.bodyText,
  });
}

function normalizeAlertInput(input: SensitiveAlertInput) {
  return {
    sourceType: input.sourceType,
    content: (input.content || '').trim(),
    teamId: input.teamId || null,
    sourceId: input.sourceId || null,
    playerId: input.playerId || null,
    playerName: input.playerName || null,
  };
}

export async function queueSensitiveAlertIfNeeded(input: SensitiveAlertInput) {
  if (!isSensitiveAlertEnabled()) {
    return { queued: false, matchedKeywords: [] as string[] };
  }

  try {
    const normalized = normalizeAlertInput(input);
    if (!normalized.content) {
      return { queued: false, matchedKeywords: [] as string[] };
    }

    const matchedKeywords = matchSensitiveKeywords(normalized.content);
    if (matchedKeywords.length === 0) {
      return { queued: false, matchedKeywords: [] as string[] };
    }

    await prisma.sensitiveAlert.create({
      data: {
        teamId: normalized.teamId,
        sourceType: normalized.sourceType,
        sourceId: normalized.sourceId,
        playerId: normalized.playerId,
        playerName: normalized.playerName,
        content: normalized.content,
        matchedKeywords: serializeMatchedKeywords(matchedKeywords),
        status: 'pending',
      },
    });

    return { queued: true, matchedKeywords };
  } catch (error) {
    console.error('queueSensitiveAlertIfNeeded error:', error);
    return { queued: false, matchedKeywords: [] as string[] };
  }
}

export async function queueSensitiveAlertsIfNeeded(inputs: SensitiveAlertInput[]) {
  if (!isSensitiveAlertEnabled() || inputs.length === 0) {
    return { queued: 0, matched: 0 };
  }

  const createData: Array<{
    teamId: string | null;
    sourceType: string;
    sourceId: string | null;
    playerId: string | null;
    playerName: string | null;
    content: string;
    matchedKeywords: string;
    status: string;
  }> = [];

  for (const input of inputs) {
    const normalized = normalizeAlertInput(input);
    if (!normalized.content) continue;

    const matchedKeywords = matchSensitiveKeywords(normalized.content);
    if (matchedKeywords.length === 0) continue;

    createData.push({
      teamId: normalized.teamId,
      sourceType: normalized.sourceType,
      sourceId: normalized.sourceId,
      playerId: normalized.playerId,
      playerName: normalized.playerName,
      content: normalized.content,
      matchedKeywords: serializeMatchedKeywords(matchedKeywords),
      status: 'pending',
    });
  }

  if (createData.length === 0) {
    return { queued: 0, matched: 0 };
  }

  try {
    const result = await prisma.sensitiveAlert.createMany({ data: createData });
    return { queued: result.count, matched: createData.length };
  } catch (error) {
    console.error('queueSensitiveAlertsIfNeeded error:', error);
    return { queued: 0, matched: createData.length };
  }
}

export async function dispatchSensitiveAlertsBatch(): Promise<DispatchResult> {
  if (!isSensitiveAlertEnabled() || !shouldSendMail()) {
    return { scanned: 0, claimed: 0, sent: 0, failed: 0 };
  }

  const maxAttempts = getMaxAttempts();
  const retryIntervalSeconds = getRetryIntervalSeconds();
  const retryBefore = new Date(Date.now() - retryIntervalSeconds * 1000);

  const candidates = await prisma.sensitiveAlert.findMany({
    where: {
      OR: [
        { status: 'pending' },
        {
          status: 'failed',
          attemptCount: { lt: maxAttempts },
          updatedAt: { lte: retryBefore },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: getDispatchBatchSize(),
  });

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  const claimedAlerts: ParsedAlert[] = [];

  for (const candidate of candidates) {
    const claimRes = await prisma.sensitiveAlert.updateMany({
      where: {
        id: candidate.id,
        OR: [{ status: 'pending' }, { status: 'failed' }],
      },
      data: {
        status: 'processing',
        attemptCount: { increment: 1 },
      },
    });

    if (claimRes.count === 0) continue;
    claimed++;

    claimedAlerts.push({
      id: candidate.id,
      teamId: candidate.teamId,
      sourceType: candidate.sourceType,
      sourceId: candidate.sourceId,
      playerId: candidate.playerId,
      playerName: candidate.playerName,
      content: candidate.content,
      matchedKeywords: parseMatchedKeywords(candidate.matchedKeywords),
      attemptCount: candidate.attemptCount + 1,
      createdAt: candidate.createdAt,
    });
  }

  if (claimedAlerts.length === 0) {
    return {
      scanned: candidates.length,
      claimed,
      sent,
      failed,
    };
  }

  try {
    const enrichedAlerts = await enrichAlertsForMail(claimedAlerts);
    await sendAlertMail(enrichedAlerts);
    await prisma.sensitiveAlert.updateMany({
      where: { id: { in: claimedAlerts.map((item) => item.id) } },
      data: {
        status: 'sent',
        sentAt: new Date(),
        lastError: null,
      },
    });
    sent = claimedAlerts.length;
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    for (const alert of claimedAlerts) {
      await prisma.sensitiveAlert.update({
        where: { id: alert.id },
        data: {
          status: alert.attemptCount >= maxAttempts ? 'failed_permanent' : 'failed',
          lastError: errorMessage.slice(0, 2000),
        },
      });
      failed++;
    }
  }

  return {
    scanned: candidates.length,
    claimed,
    sent,
    failed,
  };
}
