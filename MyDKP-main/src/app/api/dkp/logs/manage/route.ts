import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession, getAdminTeams } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
type TimeRangeFilter = 'latest_activity' | 'one_week' | 'two_weeks' | 'one_month' | 'half_year' | 'all';
const ACTIVITY_SOURCE_TYPES = ['earn', 'makeup'] as const;
const MASS_ACTIVITY_MIN_PLAYERS = 5;

function parseTimeRange(value?: string | null): TimeRangeFilter {
  const parsed = (value || '').trim();
  const validValues: TimeRangeFilter[] = [
    'latest_activity',
    'one_week',
    'two_weeks',
    'one_month',
    'half_year',
    'all',
  ];
  return (validValues as string[]).includes(parsed) ? (parsed as TimeRangeFilter) : 'latest_activity';
}

function appendAndCondition(where: any, condition: any) {
  if (!condition) return;
  where.AND = [...(where.AND || []), condition];
}

function getLocalDayRange(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getRollingRangeStart(timeRange: Exclude<TimeRangeFilter, 'latest_activity' | 'all'>, now: Date) {
  const start = new Date(now);
  if (timeRange === 'one_week') {
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (timeRange === 'two_weeks') {
    start.setDate(start.getDate() - 14);
    return start;
  }
  if (timeRange === 'one_month') {
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  start.setMonth(start.getMonth() - 6);
  return start;
}

function buildLogTimeOrCondition(range: { start: Date; end: Date }, inclusiveEnd = false) {
  const timeCondition = inclusiveEnd
    ? { gte: range.start, lte: range.end }
    : { gte: range.start, lt: range.end };
  return {
    OR: [
      { createdAt: timeCondition },
      { event: { is: { eventTime: timeCondition } } },
    ],
  };
}

async function buildTeamScopeWhere(teamId: string | null, superAdmin: boolean) {
  if (teamId) {
    return { teamId };
  }
  if (!superAdmin) {
    const adminTeams = await getAdminTeams();
    return { teamId: { in: adminTeams } };
  }
  return {};
}

async function resolveLatestActivityAnchor(options: { teamId: string | null; superAdmin: boolean }) {
  const teamScopeWhere = await buildTeamScopeWhere(options.teamId, options.superAdmin);
  const positiveAwardWhere = {
    ...teamScopeWhere,
    isDeleted: false,
    type: { in: [...ACTIVITY_SOURCE_TYPES] },
    OR: [
      { change: { gt: 0 } },
      { event: { is: { change: { gt: 0 } } } },
    ],
  };

  const grouped = await prisma.dkpLog.groupBy({
    by: ['eventId'],
    where: {
      ...positiveAwardWhere,
      eventId: { not: null },
    },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 300,
  });

  const massAward = grouped.find((group) => group._count._all >= MASS_ACTIVITY_MIN_PLAYERS && group._max.createdAt);
  if (massAward?._max.createdAt) {
    return massAward._max.createdAt;
  }

  const latestPositiveAward = await prisma.dkpLog.findFirst({
    where: positiveAwardWhere,
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  if (latestPositiveAward?.createdAt) {
    return latestPositiveAward.createdAt;
  }

  const latestAnyLog = await prisma.dkpLog.findFirst({
    where: {
      ...teamScopeWhere,
      isDeleted: false,
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return latestAnyLog?.createdAt || null;
}

function parsePageParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(5, parseInt(searchParams.get('pageSize') || `${DEFAULT_PAGE_SIZE}`, 10)),
  );
  return { page, pageSize };
}

function emptyResponse(view: 'entries' | 'events', page: number, pageSize: number) {
  if (view === 'events') {
    return NextResponse.json({
      events: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    });
  }
  return NextResponse.json({
    logs: [],
    total: 0,
    page,
    pageSize,
    totalPages: 0,
  });
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const superAdmin = session.role === 'super_admin';

    const { searchParams } = new URL(request.url);
    const { page, pageSize } = parsePageParams(searchParams);
    const search = searchParams.get('search')?.trim() || '';
    const type = searchParams.get('type')?.trim() || '';
    const scoreParam = searchParams.get('score')?.trim() || 'all';
    const teamId = searchParams.get('teamId');
    const timeRange = parseTimeRange(searchParams.get('timeRange'));
    const statusParam = searchParams.get('status') || 'valid';
    const status: 'valid' | 'all' | 'deleted' = ['all', 'deleted', 'valid'].includes(statusParam)
      ? (statusParam as any)
      : 'valid';
    const view = searchParams.get('view') === 'events' ? 'events' : 'entries';
    const format = searchParams.get('format')?.trim();
    const scoreFilter: 'all' | 'score' | 'positive' | 'negative' = ['all', 'score', 'positive', 'negative'].includes(scoreParam)
      ? (scoreParam as any)
      : 'all';

    if (!superAdmin) {
      const adminTeams = await getAdminTeams();
      if (adminTeams.length === 0) {
        return emptyResponse(view, page, pageSize);
      }
      if (teamId && !adminTeams.includes(teamId)) {
        return emptyResponse(view, page, pageSize);
      }
    }

    if (format === 'csv') {
      return exportEntriesCsv({
        search,
        type,
        timeRange,
        scoreFilter,
        teamId,
        status,
        superAdmin,
      });
    }

    if (view === 'events') {
      return handleEventView({
        page,
        pageSize,
        search,
        type,
        timeRange,
        scoreFilter,
        teamId,
        status,
        superAdmin,
      });
    }

    return handleEntryView({
      page,
      pageSize,
      search,
      type,
      timeRange,
      scoreFilter,
      teamId,
      status,
      superAdmin,
    });
  } catch (error) {
    console.error('GET /api/dkp/logs/manage error', error);
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}

async function handleEntryView(options: {
  page: number;
  pageSize: number;
  search: string;
  type: string;
  timeRange: TimeRangeFilter;
  scoreFilter: 'all' | 'score' | 'positive' | 'negative';
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { page, pageSize, search, type, timeRange, scoreFilter, teamId, status, superAdmin } = options;

  const where: any = {};
  if (status === 'valid') {
    where.isDeleted = false;
  } else if (status === 'deleted') {
    where.isDeleted = true;
  }
  if (teamId) {
    where.teamId = teamId;
  } else if (!superAdmin) {
    const adminTeams = await getAdminTeams();
    where.teamId = { in: adminTeams };
  }

  if (search) {
    where.OR = [
      {
        player: {
          is: {
            name: {
              contains: search,
            },
          },
        },
      },
      { reason: { contains: search } },
      { operator: { contains: search } },
      {
        event: {
          is: {
            reason: {
              contains: search,
            },
          },
        },
      },
    ];
  }
  if (type) {
    where.type = type;
  }
  if (scoreFilter !== 'all') {
    const scoreCondition =
      scoreFilter === 'positive'
        ? { gt: 0 }
        : scoreFilter === 'negative'
        ? { lt: 0 }
        : { not: 0 };
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { change: scoreCondition },
          { event: { is: { change: scoreCondition } } },
        ],
      },
    ];
  }

  if (timeRange !== 'all') {
    const now = new Date();
    if (timeRange === 'latest_activity') {
      const activityAnchor = await resolveLatestActivityAnchor({ teamId, superAdmin });
      if (!activityAnchor) {
        return NextResponse.json({
          logs: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        });
      }
      const latestRange = getLocalDayRange(activityAnchor);
      appendAndCondition(where, buildLogTimeOrCondition({ start: latestRange.start, end: now }, true));
    } else {
      const start = getRollingRangeStart(timeRange, now);
      appendAndCondition(where, buildLogTimeOrCondition({ start, end: now }, true));
    }
  }

  const [logs, total] = await prisma.$transaction([
    prisma.dkpLog.findMany({
      where,
      include: {
        player: { select: { name: true } },
        team: { select: { name: true } },
        deletedByAdmin: { select: { username: true } },
        event: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dkpLog.count({ where }),
  ]);

  const normalizedLogs = logs.map((log) => {
    const { event, ...rest } = log;
    const effectiveChange = log.change ?? event?.change ?? 0;
    const effectiveReason = log.reason ?? event?.reason ?? null;
    const effectiveItem = log.item ?? event?.item ?? null;
    const effectiveBoss = log.boss ?? event?.boss ?? null;
    const effectiveCreatedAt = event?.eventTime ?? log.createdAt;
    const effectiveOperator = log.operator || event?.operator || '';

    return {
      ...rest,
      change: effectiveChange,
      reason: effectiveReason,
      item: effectiveItem,
      boss: effectiveBoss,
      createdAt: effectiveCreatedAt,
      operator: effectiveOperator,
    };
  });

  return NextResponse.json({
    logs: normalizedLogs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

async function handleEventView(options: {
  page: number;
  pageSize: number;
  search: string;
  type: string;
  timeRange: TimeRangeFilter;
  scoreFilter: 'all' | 'score' | 'positive' | 'negative';
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { page, pageSize, search, type, timeRange, scoreFilter, teamId, status, superAdmin } = options;

  const filters: any[] = [];
  const logFilter =
    status === 'all' ? {} : status === 'deleted' ? { isDeleted: true } : { isDeleted: false };

  if (teamId) {
    filters.push({ teamId });
  } else if (!superAdmin) {
    const adminTeams = await getAdminTeams();
    filters.push({ teamId: { in: adminTeams } });
  }

  if (status !== 'all') {
    filters.push({ logs: { some: logFilter } });
  }

  if (search) {
    filters.push({
      OR: [
        { reason: { contains: search } },
        {
          logs: {
            some: {
              ...logFilter,
              player: {
                name: {
                  contains: search,
                },
              },
            },
          },
        },
      ],
    });
  }
  if (type) {
    filters.push({ type });
  }
  if (scoreFilter !== 'all') {
    const scoreCondition =
      scoreFilter === 'positive'
        ? { gt: 0 }
        : scoreFilter === 'negative'
        ? { lt: 0 }
        : { not: 0 };
    filters.push({ change: scoreCondition });
  }

  if (timeRange !== 'all') {
    const now = new Date();
    if (timeRange === 'latest_activity') {
      const activityAnchor = await resolveLatestActivityAnchor({ teamId, superAdmin });
      if (!activityAnchor) {
        return NextResponse.json({
          events: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        });
      }
      const latestRange = getLocalDayRange(activityAnchor);
      filters.push({ eventTime: { gte: latestRange.start, lte: now } });
    } else {
      const start = getRollingRangeStart(timeRange, now);
      filters.push({ eventTime: { gte: start, lte: now } });
    }
  }

  const where = filters.length ? { AND: filters } : {};

  const events = await prisma.dkpEvent.findMany({
    where,
    include: {
      team: { select: { name: true } },
      logs: {
        where: logFilter,
        include: {
          player: { select: { name: true, class: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { eventTime: 'desc' },
  });

  const normalizedEvents = events
    .map((event) => {
      const players = event.logs.map((log) => ({
        id: log.id,
        playerId: log.playerId,
        playerName: log.player?.name || '',
        playerClass: log.player?.class || null,
        isDeleted: log.isDeleted,
        change: log.change ?? event.change,
        reason: log.reason ?? event.reason,
        operator: log.operator || event.operator,
      }));

      if (status !== 'all' && players.length === 0) {
        return null;
      }

      return {
        id: event.id,
        teamId: event.teamId,
        teamName: event.team.name,
        type: event.type,
        change: event.change,
        reason: event.reason,
        item: event.item,
        boss: event.boss,
        operator: event.operator,
        eventTime: event.eventTime,
        players,
      };
    })
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  // 合并同一时间的衰减事件，避免每人一条导致过度拆分
  const mergedEvents: any[] = [];
  const decayMergeMap = new Map<string, any>();

  for (const evt of normalizedEvents) {
    if (evt.type === 'decay') {
      const key = `${evt.teamId}|${new Date(evt.eventTime).toISOString()}`;
      const existing = decayMergeMap.get(key);
      if (existing) {
        existing.players.push(...evt.players);
        existing.change += evt.change ?? 0;
        if (!existing.reason && evt.reason) existing.reason = evt.reason;
        continue;
      }
      const clone = { ...evt, players: [...evt.players] };
      decayMergeMap.set(key, clone);
      mergedEvents.push(clone);
    } else {
      mergedEvents.push(evt);
    }
  }

  // 重新分页（按事件时间降序）
  mergedEvents.sort((a, b) => new Date(b.eventTime).getTime() - new Date(a.eventTime).getTime());
  const total = mergedEvents.length;
  const start = (page - 1) * pageSize;
  const pagedEvents = mergedEvents.slice(start, start + pageSize);

  return NextResponse.json({
    events: pagedEvents,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const superAdmin = session.role === 'super_admin';
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '缺少要删除的记录' }, { status: 400 });
    }

    const logs = await prisma.dkpLog.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        playerId: true,
        teamId: true,
        change: true,
        type: true,
        isDeleted: true,
        createdAt: true,
        event: { select: { change: true, eventTime: true } },
      },
    });

    if (logs.length === 0) {
      return NextResponse.json({ error: '未找到这些日志' }, { status: 404 });
    }

    if (!superAdmin) {
      const adminTeams = await getAdminTeams();
      const allowed = new Set(adminTeams);
      const unauthorized = logs.some((log) => !allowed.has(log.teamId));
      if (unauthorized) {
        return NextResponse.json({ error: '包含没有权限的团队记录' }, { status: 403 });
      }
    }

    const logsToDelete = logs.filter((log) => !log.isDeleted);
    if (logsToDelete.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const log of logsToDelete) {
        const effectiveChange = log.change ?? log.event?.change ?? 0;
        const isDecayLog = log.type === 'decay';
        let currentDelta = -effectiveChange; // 默认完全回滚该条日志的影响
        let decayPortionToRevert = 0;

        // 对非衰减日志，仅计算该日志之后执行的衰减对它的影响
        if (!isDecayLog) {
          const anchorTime = log.event?.eventTime ?? log.createdAt;
          const decayHistories = await tx.decayHistory.findMany({
            where: {
              teamId: log.teamId,
              executedAt: { gt: anchorTime },
            },
            select: { rate: true },
          });

          const decayMultiplier = decayHistories.reduce((acc, h) => acc * (1 - Number(h.rate)), 1);
          // 这条日志在当前分数中的实际贡献 = 原始变动 *（后续衰减乘积）
          const decayAdjustedChange = effectiveChange * decayMultiplier;
          // currentDelta 是需要加/减回去的量（去掉这条日志的实际贡献）
          currentDelta = -decayAdjustedChange;
          // totalDecay 需要扣掉因这条日志而产生的衰减份额
          decayPortionToRevert = Math.abs(effectiveChange - decayAdjustedChange);
        }

        const playerUpdate: any = {
          // 移除当前仍然生效的分值贡献（已考虑后续衰减的影响）
          currentDkp: { increment: currentDelta },
        };

        if (isDecayLog) {
          playerUpdate.totalDecay = { decrement: Math.abs(effectiveChange) };
        } else {
          if (effectiveChange > 0) {
            playerUpdate.totalEarned = { decrement: effectiveChange };
          } else if (effectiveChange < 0) {
            playerUpdate.totalSpent = { decrement: Math.abs(effectiveChange) };
          }
          if (decayPortionToRevert > 0) {
            playerUpdate.totalDecay = { decrement: decayPortionToRevert };
          }
        }

        await tx.player.update({
          where: { id: log.playerId },
          data: playerUpdate,
        });

        await tx.dkpLog.update({
          where: { id: log.id },
          data: {
            isDeleted: true,
            deletedAt: now,
            deletedByAdminId: session.adminId || null,
          },
        });
      }
    });

    return NextResponse.json({ success: true, deleted: logsToDelete.length });
  } catch (error) {
    console.error('DELETE /api/dkp/logs/manage error', error);
    return NextResponse.json({ error: '删除日志失败' }, { status: 500 });
  }
}

async function exportEntriesCsv(options: {
  search: string;
  type: string;
  timeRange: TimeRangeFilter;
  scoreFilter: 'all' | 'score' | 'positive' | 'negative';
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { search, type, timeRange, scoreFilter, teamId, status, superAdmin } = options;

  const where: any = {};
  if (status === 'valid') {
    where.isDeleted = false;
  } else if (status === 'deleted') {
    where.isDeleted = true;
  }
  if (teamId) {
    where.teamId = teamId;
  } else if (!superAdmin) {
    const adminTeams = await getAdminTeams();
    where.teamId = { in: adminTeams };
  }

  if (search) {
    where.OR = [
      {
        player: {
          is: {
            name: {
              contains: search,
            },
          },
        },
      },
      { reason: { contains: search } },
      { operator: { contains: search } },
      {
        event: {
          is: {
            reason: {
              contains: search,
            },
          },
        },
      },
    ];
  }
  if (type) {
    where.type = type;
  }
  if (scoreFilter !== 'all') {
    const scoreCondition =
      scoreFilter === 'positive'
        ? { gt: 0 }
        : scoreFilter === 'negative'
        ? { lt: 0 }
        : { not: 0 };
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { change: scoreCondition },
          { event: { is: { change: scoreCondition } } },
        ],
      },
    ];
  }

  if (timeRange !== 'all') {
    const now = new Date();
    if (timeRange === 'latest_activity') {
      const activityAnchor = await resolveLatestActivityAnchor({ teamId, superAdmin });
      if (!activityAnchor) {
        const emptyCsv = '\uFEFF' + '玩家,分数,原因,日期,时间,团队';
        const response = new NextResponse(emptyCsv);
        response.headers.set('Content-Type', 'text/csv; charset=utf-8');
        response.headers.set('Content-Disposition', 'attachment; filename="dkp_logs.csv"');
        return response;
      }
      const latestRange = getLocalDayRange(activityAnchor);
      appendAndCondition(where, buildLogTimeOrCondition({ start: latestRange.start, end: now }, true));
    } else {
      const start = getRollingRangeStart(timeRange, now);
      appendAndCondition(where, buildLogTimeOrCondition({ start, end: now }, true));
    }
  }

  const logs = await prisma.dkpLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      player: { select: { name: true } },
      team: { select: { name: true } },
      event: true,
    },
  });

  const rows = logs.map((log) => {
    const effectiveChange = log.change ?? log.event?.change ?? 0;
    const effectiveReason = log.reason ?? log.event?.reason ?? '';
    const effectiveCreatedAt = log.event?.eventTime ?? log.createdAt;
    const date = new Date(effectiveCreatedAt);
    const dateStr = date.toISOString().slice(0, 10);
    const timeStr = date.toTimeString().slice(0, 8);
    return {
      player: log.player?.name || '',
      change: effectiveChange,
      reason: effectiveReason.replace(/"/g, '""'),
      date: dateStr,
      time: timeStr,
      team: log.team?.name || '',
    };
  });

  const header = '玩家,分数,原因,日期,时间,团队';
  const lines = rows.map(
    (r) =>
      `"${r.player.replace(/"/g, '""')}",${r.change},"${r.reason}","${r.date}","${r.time}","${r.team.replace(/"/g, '""')}"`
  );
  const csv = '\uFEFF' + [header, ...lines].join('\n');

  const response = new NextResponse(csv);
  response.headers.set('Content-Type', 'text/csv; charset=utf-8');
  response.headers.set('Content-Disposition', 'attachment; filename="dkp_logs.csv"');
  return response;
}
