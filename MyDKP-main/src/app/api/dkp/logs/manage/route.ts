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
    Math.max(5, parseInt(searchParams.get('pageSize') || `${DEFAULT_PAGE_SIZE}`, 10))
  );
  return { page, pageSize };
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

    const where: any = {};
    if (!includeDeleted) {
      where.isDeleted = false;
    }
    if (teamId) {
      where.teamId = teamId;
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

    if (!superAdmin) {
      const adminTeams = await getAdminTeams();
      if (adminTeams.length === 0) {
        return NextResponse.json({
          logs: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0,
        });
      }
      const allowed = new Set(adminTeams);
      if (teamId) {
        if (!allowed.has(teamId)) {
          return NextResponse.json({
            logs: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          });
        }
      } else {
        where.teamId = { in: adminTeams };
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
      const effectiveChange = log.change ?? log.event?.change ?? 0;
      const effectiveReason = log.reason ?? log.event?.reason ?? null;
      const effectiveItem = log.item ?? log.event?.item ?? null;
      const effectiveBoss = log.boss ?? log.event?.boss ?? null;
      const effectiveCreatedAt = log.event?.eventTime ?? log.createdAt;
      const effectiveOperator = log.operator || log.event?.operator || '';

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
  } catch (error) {
    console.error('GET /api/dkp/logs/manage error', error);
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
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
