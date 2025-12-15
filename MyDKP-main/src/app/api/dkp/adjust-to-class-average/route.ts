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
    const { playerId, teamId } = await request.json();

    if (!playerId || !teamId) {
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

    // 计算忽略近 6 天补分后的职业均分
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    const [classPlayers, makeupSumAgg] = await prisma.$transaction([
      prisma.player.findMany({
        where: { teamId, class: player.class },
        select: { id: true, currentDkp: true },
      }),
      prisma.dkpLog.aggregate({
        _sum: { change: true },
        where: {
          teamId,
          type: 'makeup',
          isDeleted: false,
          createdAt: { gte: sixDaysAgo },
          player: { class: player.class },
        },
      }),
    ]);

    if (classPlayers.length === 0) {
      return NextResponse.json({ error: '该职业暂无玩家，无法计算均分' }, { status: 400 });
    }

    const currentTotal = classPlayers.reduce((sum, p) => sum + Number(p.currentDkp || 0), 0);
    const recentMakeup = Number(makeupSumAgg._sum.change || 0);
    const targetAvg = Number(((currentTotal - recentMakeup) / classPlayers.length).toFixed(2));
    const current = Number(player.currentDkp);
    const delta = Number((targetAvg - current).toFixed(2));

    if (delta === 0) {
      return NextResponse.json({
        success: true,
        message: '当前分数已等于职业平均，无需补分',
        classAverage: targetAvg.toFixed(2),
        before: current.toFixed(2),
        delta: delta.toFixed(2),
      });
    }

    const reason = `补至职业平均（职业：${player.class}，平均：${targetAvg.toFixed(
      2,
    )}，当前：${current.toFixed(2)}，补分：${delta.toFixed(2)}，近6天补分已剔除）`;

    const event = await prisma.dkpEvent.create({
      data: {
        teamId,
        type: 'makeup',
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
          type: 'makeup',
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
