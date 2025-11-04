import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { teamId, rate } = await request.json();

    if (!teamId || rate === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    if (rate <= 0 || rate >= 1) {
      return NextResponse.json({ error: '衰减比例必须在 0 到 1 之间' }, { status: 400 });
    }

    const players = await prisma.player.findMany({ where: { teamId } });

    if (players.length === 0) {
      return NextResponse.json({ error: '该团队没有玩家' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const player of players) {
        const decayAmount = player.currentDkp * rate;
        const newDkp = player.currentDkp - decayAmount;

        await tx.player.update({
          where: { id: player.id },
          data: { currentDkp: newDkp },
        });

        await tx.dkpLog.create({
          data: {
            playerId: player.id,
            teamId,
            type: 'decay',
            change: -decayAmount,
            reason: `衰减 ${(rate * 100).toFixed(1)}%`,
            operator: session.username || 'admin',
          },
        });
      }

      await tx.decayHistory.create({
        data: {
          teamId,
          rate,
          operator: session.username || 'admin',
          affectedCount: players.length,
        },
      });
    });

    return NextResponse.json({ success: true, affected: players.length });
  } catch (error) {
    console.error('Decay error:', error);
    return NextResponse.json({ error: '衰减失败' }, { status: 500 });
  }
}