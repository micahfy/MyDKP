import { prisma } from '@/lib/prisma';
import { isSensitiveAlertEnabled, matchSensitiveKeywords } from '@/lib/sensitiveKeywords';
import nodemailer, { type Transporter } from 'nodemailer';

type SensitiveSourceType = 'player_name' | 'log_reason';
type MailProvider = 'office365' | 'smtp';

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

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  requireTls: boolean;
  allowSelfSignedCerts: boolean;
};

const MAX_ATTEMPTS_DEFAULT = 5;
const DISPATCH_BATCH_SIZE_DEFAULT = 50;
const RETRY_INTERVAL_SECONDS_DEFAULT = 300;

let tokenCache: { token: string; expiresAtMs: number } | null = null;
let smtpTransporterCache: { cacheKey: string; transporter: Transporter } | null = null;

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

function getMailProvider(): MailProvider {
  const explicit = (process.env.SENSITIVE_ALERT_MAIL_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'smtp' || explicit === 'office365') {
    return explicit;
  }
  if ((process.env.SMTP_HOST || '').trim()) {
    return 'smtp';
  }
  return 'office365';
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

function buildMailSubject(alerts: EnrichedParsedAlert[]) {
  if (alerts.length === 1) {
    const alert = alerts[0];
    const teamText = alert.teamName || alert.teamId || 'unknown';
    return `[MyDKP Sensitive Alert] ${alert.sourceType} ${teamText}`;
  }

  const teamCount = new Set(alerts.map((item) => item.teamName || item.teamId || 'unknown')).size;
  return `[MyDKP Sensitive Alert] ${alerts.length} records (teams:${teamCount})`;
}

function buildMailBody(alerts: EnrichedParsedAlert[]) {
  const sortedAlerts = [...alerts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = sortedAlerts[0];
  const last = sortedAlerts[sortedAlerts.length - 1];
  const sourceTypes = [...new Set(sortedAlerts.map((item) => item.sourceType))];

  const lines = [
    'Sensitive content detected in MyDKP.',
    '',
    `Batch Count: ${sortedAlerts.length}`,
    `Time Range: ${first.createdAt.toISOString()} ~ ${last.createdAt.toISOString()}`,
    `Source Types: ${sourceTypes.join(', ')}`,
  ];

  for (let index = 0; index < sortedAlerts.length; index++) {
    const alert = sortedAlerts[index];
    lines.push('');
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
  }

  return lines.join('\n');
}

async function getOffice365AccessToken() {
  const tenantId = (process.env.O365_TENANT_ID || '').trim();
  const clientId = (process.env.O365_CLIENT_ID || '').trim();
  const clientSecret = (process.env.O365_CLIENT_SECRET || '').trim();

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Office365 credentials (O365_TENANT_ID/O365_CLIENT_ID/O365_CLIENT_SECRET).');
  }

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Office365 token request failed: ${tokenRes.status} ${text}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = String(tokenData.access_token || '');
  const expiresIn = Number(tokenData.expires_in || 3600);

  if (!accessToken) {
    throw new Error('Office365 token missing access_token.');
  }

  tokenCache = {
    token: accessToken,
    expiresAtMs: now + Math.max(300, expiresIn - 120) * 1000,
  };
  return accessToken;
}

function getSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST || '').trim();
  if (!host) {
    throw new Error('Missing SMTP_HOST.');
  }

  const secure = toBool(process.env.SMTP_SECURE, false);
  const defaultPort = secure ? 465 : 587;
  const portValue = Number(process.env.SMTP_PORT || defaultPort);
  if (!Number.isFinite(portValue) || portValue <= 0) {
    throw new Error('Invalid SMTP_PORT.');
  }

  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  if (!user || !pass) {
    throw new Error('Missing SMTP credentials (SMTP_USER/SMTP_PASS).');
  }

  const from = (process.env.SMTP_FROM || user).trim();
  if (!from) {
    throw new Error('Missing SMTP_FROM.');
  }

  return {
    host,
    port: Math.floor(portValue),
    secure,
    user,
    pass,
    from,
    requireTls: toBool(process.env.SMTP_REQUIRE_TLS, false),
    allowSelfSignedCerts: toBool(process.env.SMTP_ALLOW_SELF_SIGNED_CERTS, false),
  };
}

function getSmtpTransporter(config: SmtpConfig) {
  const cacheKey = [
    config.host,
    String(config.port),
    config.secure ? '1' : '0',
    config.user,
    config.pass,
    config.from,
    config.requireTls ? '1' : '0',
    config.allowSelfSignedCerts ? '1' : '0',
  ].join('|');

  if (smtpTransporterCache && smtpTransporterCache.cacheKey === cacheKey) {
    return smtpTransporterCache.transporter;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    requireTLS: config.requireTls,
    tls: {
      rejectUnauthorized: !config.allowSelfSignedCerts,
    },
  });

  smtpTransporterCache = { cacheKey, transporter };
  return transporter;
}

async function sendSmtpMail(alerts: EnrichedParsedAlert[]) {
  const recipients = getRecipients();
  if (recipients.length === 0) {
    throw new Error('Missing SENSITIVE_ALERT_RECIPIENTS.');
  }

  const config = getSmtpConfig();
  const transporter = getSmtpTransporter(config);

  await transporter.sendMail({
    from: config.from,
    to: recipients.join(','),
    subject: buildMailSubject(alerts),
    text: buildMailBody(alerts),
  });
}

async function sendOffice365Mail(alerts: EnrichedParsedAlert[]) {
  const sender = (process.env.O365_SENDER || '').trim();
  const recipients = getRecipients();

  if (!sender) {
    throw new Error('Missing O365_SENDER.');
  }
  if (recipients.length === 0) {
    throw new Error('Missing SENSITIVE_ALERT_RECIPIENTS.');
  }

  const token = await getOffice365AccessToken();
  const subject = buildMailSubject(alerts);
  const bodyText = buildMailBody(alerts);

  const payload = {
    message: {
      subject,
      body: {
        contentType: 'Text',
        content: bodyText,
      },
      toRecipients: recipients.map((address) => ({
        emailAddress: { address },
      })),
    },
    saveToSentItems: 'false',
  };

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Office365 sendMail failed: ${res.status} ${text}`);
  }
}

async function sendAlertMail(alerts: EnrichedParsedAlert[]) {
  if (alerts.length === 0) return;

  const provider = getMailProvider();
  if (provider === 'smtp') {
    await sendSmtpMail(alerts);
    return;
  }
  await sendOffice365Mail(alerts);
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
