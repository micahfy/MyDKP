import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const { teamId } = await request.json();

    if (!teamId) {
      return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
    }

    // 检查团队权限
    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

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
        createdAt: { 
          gte: lastDecay.executedAt,
        },
      },
      orderBy: {
        createdAt: 'asc'
      },
    });

    console.log(`找到 ${decayLogs.length} 条衰减日志需要撤销`);

    if (decayLogs.length === 0) {
      return NextResponse.json({ error: '未找到相关的衰减日志' }, { status: 404 });
    }

    let affectedPlayers = 0;

    await prisma.$transaction(async (tx) => {
      for (const log of decayLogs) {
        const player = await tx.player.findUnique({
          where: { id: log.playerId },
        });

        if (player) {
          const undoChange = -log.change;
          const newDkp = player.currentDkp + undoChange;

          await tx.player.update({
            where: { id: log.playerId },
            data: { currentDkp: newDkp },
          });

          await tx.dkpLog.create({
            data: {
              playerId: log.playerId,
              teamId,
              type: 'undo',
              change: undoChange,
              reason: `撤销衰减 (原因: ${log.reason || '未知'})`,
              operator: session.username || 'admin',
            },
          });

          affectedPlayers++;
        }
      }

      await tx.decayHistory.update({
        where: { id: lastDecay.id },
        data: { status: 'undone' },
      });
    });

    console.log(`成功撤销 ${affectedPlayers} 名玩家的衰减`);

    return NextResponse.json({ 
      success: true,
      affectedPlayers,
      message: `已撤销 ${affectedPlayers} 名玩家的衰减` 
    });
  } catch (error) {
    console.error('撤销衰减失败:', error);
    return NextResponse.json({ error: '撤销失败' }, { status: 500 });
  }
}