import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const session = await getSession();
    const { teamId, rate } = await request.json();

    const players = await prisma.player.findMany({ where: { teamId } });

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
    return NextResponse.json({ error: '衰减失败' }, { status: 500 });
  }
}