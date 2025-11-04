import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const session = await getSession();
    const { teamId } = await request.json();

    const lastDecay = await prisma.decayHistory.findFirst({
      where: { teamId, status: 'normal' },
      orderBy: { executedAt: 'desc' },
    });

    if (!lastDecay) {
      return NextResponse.json({ error: '没有可撤销的衰减记录' }, { status: 404 });
    }

    const decayLogs = await prisma.dkpLog.findMany({
      where: {
        teamId,
        type: 'decay',
        createdAt: { gte: lastDecay.executedAt },
      },
    });

    await prisma.$transaction(async (tx) => {
      for (const log of decayLogs) {
        const player = await tx.player.findUnique({
          where: { id: log.playerId },
        });

        if (player) {
          await tx.player.update({
            where: { id: log.playerId },
            data: { currentDkp: player.currentDkp - log.change },
          });

          await tx.dkpLog.create({
            data: {
              playerId: log.playerId,
              teamId,
              type: 'undo',
              change: -log.change,
              reason: '撤销衰减',
              operator: session.username || 'admin',
            },
          });
        }
      }

      await tx.decayHistory.update({
        where: { id: lastDecay.id },
        data: { status: 'undone' },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '撤销失败' }, { status: 500 });
  }
}