import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession, getAdminTeams } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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
    const teamId = searchParams.get('teamId');
    const statusParam = searchParams.get('status') || 'valid';
    const status: 'valid' | 'all' | 'deleted' = ['all', 'deleted', 'valid'].includes(statusParam)
      ? (statusParam as any)
      : 'valid';
    const view = searchParams.get('view') === 'events' ? 'events' : 'entries';
    const format = searchParams.get('format')?.trim();

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
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { page, pageSize, search, type, teamId, status, superAdmin } = options;

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
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { page, pageSize, search, type, teamId, status, superAdmin } = options;

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

  const where = filters.length ? { AND: filters } : {};

  const [events, total] = await prisma.$transaction([
    prisma.dkpEvent.findMany({
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dkpEvent.count({ where }),
  ]);

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
    .filter(Boolean);

  return NextResponse.json({
    events: normalizedEvents,
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
  teamId: string | null;
  status: 'valid' | 'all' | 'deleted';
  superAdmin: boolean;
}) {
  const { search, type, teamId, status, superAdmin } = options;

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
