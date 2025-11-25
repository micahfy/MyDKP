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
    const teamId = searchParams.get('teamId');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';
    const view = searchParams.get('view') === 'events' ? 'events' : 'entries';

    if (!superAdmin) {
      const adminTeams = await getAdminTeams();
      if (adminTeams.length === 0) {
        return emptyResponse(view, page, pageSize);
      }
      if (teamId && !adminTeams.includes(teamId)) {
        return emptyResponse(view, page, pageSize);
      }
    }

    if (view === 'events') {
      return handleEventView({
        page,
        pageSize,
        search,
        teamId,
        includeDeleted,
        superAdmin,
      });
    }

    return handleEntryView({
      page,
      pageSize,
      search,
      teamId,
      includeDeleted,
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
  teamId: string | null;
  includeDeleted: boolean;
  superAdmin: boolean;
}) {
  const { page, pageSize, search, teamId, includeDeleted, superAdmin } = options;

  const where: any = {};
  if (!includeDeleted) {
    where.isDeleted = false;
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
  teamId: string | null;
  includeDeleted: boolean;
  superAdmin: boolean;
}) {
  const { page, pageSize, search, teamId, includeDeleted, superAdmin } = options;

  const filters: any[] = [];
  const logFilter = includeDeleted ? {} : { isDeleted: false };

  if (teamId) {
    filters.push({ teamId });
  } else if (!superAdmin) {
    const adminTeams = await getAdminTeams();
    filters.push({ teamId: { in: adminTeams } });
  }

  if (!includeDeleted) {
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

      if (!includeDeleted && players.length === 0) {
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
        event: { select: { change: true } },
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
        const playerUpdate: any = {
          currentDkp: { increment: -effectiveChange },
        };

        if (log.type === 'decay') {
          playerUpdate.totalDecay = { decrement: Math.abs(effectiveChange) };
        } else if (effectiveChange > 0) {
          playerUpdate.totalEarned = { decrement: effectiveChange };
        } else if (effectiveChange < 0) {
          playerUpdate.totalSpent = { decrement: Math.abs(effectiveChange) };
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
