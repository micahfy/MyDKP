import { prisma } from '@/lib/prisma';

const ACTIVITY_DAY_LIMIT = 10;
const ACTIVITY_DAY_MIN_PLAYERS = 10;

function toBeijingDate(date: Date): string {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toUtcRangeOfBeijingDay(day: string) {
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function isPostgresUrl(url: string) {
  const normalized = url.trim().toLowerCase();
  return normalized.startsWith('postgres://') || normalized.startsWith('postgresql://');
}

async function fetchRecentActivityDays(teamId: string) {
  const dbUrl = process.env.DATABASE_URL || '';

  if (isPostgresUrl(dbUrl)) {
    const rows = await prisma.$queryRaw<Array<{ dayKey: string }>>`
      SELECT day_key AS "dayKey"
      FROM (
        SELECT
          to_char((COALESCE(e."eventTime", l."createdAt") + interval '8 hour')::date, 'YYYY-MM-DD') AS day_key,
          COUNT(DISTINCT l."playerId") AS player_count
        FROM "dkp_logs" l
        LEFT JOIN "dkp_events" e ON e."id" = l."eventId"
        WHERE
          l."teamId" = ${teamId}
          AND l."isDeleted" = false
          AND COALESCE(l."change", e."change", 0) > 0
        GROUP BY day_key
        HAVING COUNT(DISTINCT l."playerId") >= ${ACTIVITY_DAY_MIN_PLAYERS}
        ORDER BY day_key DESC
        LIMIT ${ACTIVITY_DAY_LIMIT}
      ) recent_days
      ORDER BY day_key ASC
    `;
    return rows.map((row) => row.dayKey).filter(Boolean);
  }

  const rows = await prisma.$queryRaw<Array<{ dayKey: string }>>`
    SELECT day_key AS dayKey
    FROM (
      SELECT
        date(datetime(COALESCE(e.eventTime, l.createdAt), '+8 hours')) AS day_key,
        COUNT(DISTINCT l.playerId) AS player_count
      FROM dkp_logs l
      LEFT JOIN dkp_events e ON e.id = l.eventId
      WHERE
        l.teamId = ${teamId}
        AND l.isDeleted = 0
        AND COALESCE(l.change, e.change, 0) > 0
      GROUP BY day_key
      HAVING COUNT(DISTINCT l.playerId) >= ${ACTIVITY_DAY_MIN_PLAYERS}
      ORDER BY day_key DESC
      LIMIT ${ACTIVITY_DAY_LIMIT}
    ) recent_days
    ORDER BY day_key ASC
  `;

  return rows.map((row) => row.dayKey).filter(Boolean);
}

/**
 * Recalculate team attendance using the latest 10 activity days.
 *
 * Activity day:
 * - At least 10 distinct players have an effective positive score log on that day.
 *
 * Player attendance:
 * - Has at least one effective positive score log on the activity day.
 * - Denominator starts from the player's first attended activity day in the 10-day window.
 */
export async function recalculateTeamAttendance(teamId: string) {
  const activityDays = await fetchRecentActivityDays(teamId);

  if (activityDays.length === 0) {
    await prisma.player.updateMany({
      where: { teamId },
      data: { attendance: 0 },
    });
    return;
  }

  const dayRanges = activityDays.map((day) => toUtcRangeOfBeijingDay(day));
  const participationLogs = await prisma.dkpLog.findMany({
    where: {
      teamId,
      isDeleted: false,
      AND: [
        {
          OR: dayRanges.map((range) => ({
            OR: [
              { createdAt: { gte: range.start, lt: range.end } },
              { event: { is: { eventTime: { gte: range.start, lt: range.end } } } },
            ],
          })),
        },
        {
          OR: [{ change: { gt: 0 } }, { event: { is: { change: { gt: 0 } } } }],
        },
      ],
    },
    select: {
      playerId: true,
      createdAt: true,
      event: { select: { eventTime: true } },
    },
  });

  const activityDaySet = new Set(activityDays);
  const attendedDaysByPlayer = new Map<string, Set<string>>();

  for (const log of participationLogs) {
    const timestamp = log.event?.eventTime ? new Date(log.event.eventTime) : new Date(log.createdAt);
    const day = toBeijingDate(timestamp);
    if (!activityDaySet.has(day)) {
      continue;
    }

    const daySet = attendedDaysByPlayer.get(log.playerId) || new Set<string>();
    daySet.add(day);
    attendedDaysByPlayer.set(log.playerId, daySet);
  }

  await prisma.player.updateMany({
    where: { teamId },
    data: { attendance: 0 },
  });

  const updates: Array<ReturnType<typeof prisma.player.update>> = [];

  for (const [playerId, daySet] of attendedDaysByPlayer) {
    const attendedDays = Array.from(daySet).sort((a, b) => a.localeCompare(b));
    if (attendedDays.length === 0) {
      continue;
    }

    const firstAttendedDay = attendedDays[0];
    const effectiveActivityDayCount = activityDays.filter((day) => day >= firstAttendedDay).length;
    if (effectiveActivityDayCount <= 0) {
      continue;
    }

    const attendance = Math.min(1, Math.max(0, attendedDays.length / effectiveActivityDayCount));

    updates.push(
      prisma.player.update({
        where: { id: playerId },
        data: { attendance },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}
