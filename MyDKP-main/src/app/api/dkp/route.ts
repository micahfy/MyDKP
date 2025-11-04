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
    const { playerId, teamId, type, change, reason, item, boss } = await request.json();

    if (!playerId || !teamId || change === undefined) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

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
    console.error('DKP operation error:', error);
    return NextResponse.json({ error: 'DKP变动失败' }, { status: 500 });
  }
}