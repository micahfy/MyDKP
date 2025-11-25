import { prisma } from '@/lib/prisma';
import { getAdminTeams } from '@/lib/auth';

export interface WebdkpLogRow {
  player: string;
  change: number;
  reason: string;
  date: string;
  time: string;
  className?: string;
}

const LOG_SECTION_PATTERN = /WebDKP_Log\s*=\s*\{([\s\S]*?)\}\s*WebDKP_DkpTable/;
const EVENT_PATTERN = /\["(.*?)"\]\s*=\s*\{([\s\S]*?)\n\t\},/g;
const POINTS_PATTERN = /\["points"\]\s*=\s*([-\d.]+)/;
const REASON_PATTERN = /\["reason"\]\s*=\s*"([^"]*)"/;
const DATE_PATTERN = /\["date"\]\s*=\s*"([^"]*)"/;
const AWARDED_PATTERN = /\["awarded"\]\s*=\s*\{([\s\S]*?)\n\t\t\},/;
const PLAYER_ENTRY_PATTERN = /\["([^"]+)"\]\s*=\s*\{([\s\S]*?)\n\s*\},/g;
const CLASS_PATTERN = /\["class"\]\s*=\s*"([^"]*)"/;

export function parseWebdkpLogs(luaContent: string): WebdkpLogRow[] {
  const match = LOG_SECTION_PATTERN.exec(luaContent);
  if (!match) {
    throw new Error('未在文件中找到 WebDKP_Log 区域');
  }

  const body = match[1];
  const rows: WebdkpLogRow[] = [];
  let eventMatch: RegExpExecArray | null;

  while ((eventMatch = EVENT_PATTERN.exec(body)) !== null) {
    const block = eventMatch[2];
    const pointsMatch = POINTS_PATTERN.exec(block);
    const reasonMatch = REASON_PATTERN.exec(block);
    const dateMatch = DATE_PATTERN.exec(block);

    const points = pointsMatch ? parseFloat(pointsMatch[1]) : 0;
    const reason = reasonMatch ? reasonMatch[1] : '';
    const dateStr = dateMatch ? dateMatch[1] : '';

    const [date, time] = splitDateTime(dateStr);
    const awardedMatch = AWARDED_PATTERN.exec(block);
    if (!awardedMatch) {
      continue;
    }

    const awardedBlock = awardedMatch[1];
    let playerMatch: RegExpExecArray | null;
    PLAYER_ENTRY_PATTERN.lastIndex = 0;
    while ((playerMatch = PLAYER_ENTRY_PATTERN.exec(awardedBlock)) !== null) {
      const player = playerMatch[1].trim();
      if (!player) continue;

      const entryBlock = playerMatch[2];
      const classMatch = CLASS_PATTERN.exec(entryBlock);
      const className = classMatch ? classMatch[1] : '';

      rows.push({
        player,
        change: points,
        reason,
        date,
        time,
        className,
      });
    }
  }

  return rows;
}

function splitDateTime(raw: string): [string, string] {
  if (!raw) return ['', ''];
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    return [parts[0], parts[1]];
  }
  return [raw.trim(), ''];
}

export function buildImportPayload(rows: WebdkpLogRow[]): string {
  return rows
    .map((row) => {
      const change = Number(row.change);
      const formattedChange = Number.isInteger(change) ? String(change) : change.toFixed(2);
      const pieces = [
        row.player.trim(),
        formattedChange,
        (row.reason || '').trim(),
        (row.date || '').trim(),
        (row.time || '').trim(),
      ];
      return pieces.join(',');
    })
    .join('\n');
}

function replaceSection(content: string, startToken: string, endToken: string, replacement: string) {
  const startIndex = content.indexOf(startToken);
  if (startIndex === -1) {
    throw new Error(`无法找到段落：${startToken}`);
  }
  const endIndex = content.indexOf(endToken, startIndex);
  if (endIndex === -1) {
    throw new Error(`无法找到段落结束：${endToken}`);
  }

  return content.slice(0, startIndex) + replacement + content.slice(endIndex);
}

export function buildUpdatedLua(originalLua: string, newTableText: string) {
  const emptyLog = 'WebDKP_Log = {\n}\n';
  let content = replaceSection(originalLua, 'WebDKP_Log', 'WebDKP_DkpTable', emptyLog);
  const trimmedTable = newTableText.trim() + '\n';
  content = replaceSection(content, 'WebDKP_DkpTable', 'WebDKP_Tables', trimmedTable);
  return content;
}

function luaEscape(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function buildWebdkpTable(session: {
  role?: string | null;
  isAdmin?: boolean;
}) {
  const players = await prisma.player.findMany({
    select: {
      name: true,
      class: true,
      currentDkp: true,
      team: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
  });

  let filteredPlayers = players;
  if (session.role !== 'super_admin') {
    const adminTeams = await getAdminTeams();
    filteredPlayers = players.filter(
      (player) => player.team && adminTeams.includes(player.team.id),
    );
  }

  const lines: string[] = [];
  lines.push('WebDKP_DkpTable = {');

  filteredPlayers.forEach((player, index) => {
    const isLast = index === filteredPlayers.length - 1;
    lines.push(`\t["${luaEscape(player.name)}"] = {`);
    lines.push('\t\t["dkp1"] = 0,');
    lines.push(`\t\t["dkp_1"] = ${Number(player.currentDkp).toFixed(2)},`);
    lines.push('\t\t["Selected"] = false,');
    lines.push(`\t\t["class"] = "${luaEscape(player.class)}",`);
    lines.push(isLast ? '\t}' : '\t},');
  });

  lines.push('}');
  return lines.join('\n');
}
