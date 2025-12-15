import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const { playerId, teamId, classAverage } = await request.json();

    if (!playerId || !teamId || classAverage === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player || player.teamId !== teamId) {
      return NextResponse.json({ error: '未找到该玩家或不属于当前团队' }, { status: 404 });
    }

    const targetAvg = Number(classAverage);
    if (Number.isNaN(targetAvg)) {
      return NextResponse.json({ error: '职业平均分无效' }, { status: 400 });
    }

    const current = Number(player.currentDkp);
    const delta = Number((targetAvg - current).toFixed(2));

    if (delta === 0) {
      return NextResponse.json({ success: true, message: '当前分数已等于职业平均，无需补分' });
    }

    const operationType = delta >= 0 ? 'earn' : 'spend';
    const reason = `补至职业平均（职业：${player.class}，平均：${targetAvg.toFixed(
      2,
    )}，当前：${current.toFixed(2)}，补分：${delta.toFixed(2)}）`;

    const event = await prisma.dkpEvent.create({
      data: {
        teamId,
        type: operationType,
        change: delta,
        reason,
        operator: session.username || 'admin',
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.player.update({
        where: { id: player.id },
        data: {
          currentDkp: { increment: delta },
          ...(delta > 0 ? { totalEarned: { increment: delta } } : {}),
          ...(delta < 0 ? { totalSpent: { increment: Math.abs(delta) } } : {}),
        },
      });

      await tx.dkpLog.create({
        data: {
          playerId: player.id,
          teamId,
          type: operationType,
          change: delta,
          reason,
          operator: session.username || 'admin',
          eventId: event.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      player: player.name,
      class: player.class,
      classAverage: targetAvg.toFixed(2),
      before: current.toFixed(2),
      delta: delta.toFixed(2),
    });
  } catch (error) {
    console.error('adjust-to-class-average error:', error);
    return NextResponse.json({ error: '补分失败' }, { status: 500 });
  }
}
