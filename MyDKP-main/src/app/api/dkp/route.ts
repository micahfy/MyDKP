import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';
import { recalculateTeamAttendance } from '@/lib/attendance';
import { applyLootHighlight, fetchLootItems } from '@/lib/loot';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { playerId, teamId, type, change, reason, item, boss, eventTime } = await request.json();

    if (!playerId || !teamId || change === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查团队权限
    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: '玩家不存在' }, { status: 404 });
    }

    // 验证玩家属于该团队
    if (player.teamId !== teamId) {
      return NextResponse.json({ error: '玩家不属于该团队' }, { status: 400 });
    }

    let effectiveEventTime = new Date();
    if (type === 'makeup' && eventTime) {
      const parsed = new Date(eventTime);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: '记录时间格式不正确' }, { status: 400 });
      }
      effectiveEventTime = parsed;
    }

    const lootItems = await fetchLootItems();
    const highlightedReason = applyLootHighlight(reason, lootItems);

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: playerId },
        data: {
          currentDkp: { increment: change },
          ...(change > 0
            ? { totalEarned: { increment: change } }
            : {}),
          ...(change < 0
            ? { totalSpent: { increment: Math.abs(change) } }
            : {}),
        },
      });

      const event = await tx.dkpEvent.create({
        data: {
          teamId,
          type,
          change,
          reason: highlightedReason,
          item,
          boss,
          operator: session.username || 'admin',
          eventTime: effectiveEventTime,
        },
      });

      await tx.dkpLog.create({
        data: {
          playerId,
          teamId,
          type,
          change,
          reason: highlightedReason,
          item,
          boss,
          operator: session.username || 'admin',
          eventId: event.id,
          createdAt: event.eventTime,
        },
      });
    });

    if (type === 'attendance') {
      await recalculateTeamAttendance(teamId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DKP operation error:', error);
    return NextResponse.json({ error: 'DKP变动失败' }, { status: 500 });
  }
}
