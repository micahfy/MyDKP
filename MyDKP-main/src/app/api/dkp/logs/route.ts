import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasTeamPermission, getSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const isAdmin = session.isAdmin === true && !!session.adminId;
    const isSuperAdmin = isAdmin && session.role === 'super_admin';

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    let effectiveTeamId = teamId;

    if (!effectiveTeamId && playerId) {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { teamId: true },
      });
      effectiveTeamId = player?.teamId || null;
    }

    if (isAdmin && !isSuperAdmin) {
      if (!effectiveTeamId) {
        return NextResponse.json(
          { error: '普通管理员必须指定团队或玩家' },
          { status: 400 }
        );
      }
      const hasPermission = await hasTeamPermission(effectiveTeamId);
      if (!hasPermission) {
        return NextResponse.json({ error: '无权访问该团队' }, { status: 403 });
      }
    } else if (!isAdmin) {
      if (!effectiveTeamId) {
        return NextResponse.json(
          { error: '访客查看日志时必须指定团队或玩家' },
          { status: 400 }
        );
      }
    }

    const where: any = {};
    if (effectiveTeamId) where.teamId = effectiveTeamId;
    if (playerId) where.playerId = playerId;
    if (!includeDeleted) {
      where.isDeleted = false;
    }

    const logs = await prisma.dkpLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        player: { select: { name: true } },
        deletedByAdmin: { select: { username: true } },
        event: true,
      },
    });

    const formatted = logs.map((log) => {
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

    return NextResponse.json(formatted);
  } catch (error) {
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}
