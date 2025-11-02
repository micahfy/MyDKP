import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const session = await getSession();
    const { playerId, teamId, type, change, reason, item, boss } =
      await request.json();

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      return NextResponse.json({ error: '玩家不存在' }, { status: 404 });
    }

    const newDkp = player.currentDkp + change;
    const newEarned = change > 0 ? player.totalEarned + change : player.totalEarned;
    const newSpent = change < 0 ? player.totalSpent + Math.abs(change) : player.totalSpent;

    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: {
          currentDkp: newDkp,
          totalEarned: newEarned,
          totalSpent: newSpent,
        },
      }),
      prisma.dkpLog.create({
        data: {
          playerId,
          teamId,
          type,
          change,
          reason,
          item,
          boss,
          operator: session.username || 'admin',
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'DKP变动失败' }, { status: 500 });
  }
}