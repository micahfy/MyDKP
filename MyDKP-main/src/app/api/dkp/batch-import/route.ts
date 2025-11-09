import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { teamId, importData } = await request.json();

    if (!teamId || !importData) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 检查团队权限
    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const lines = importData.split('\n').filter((line: string) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

    let successCount = 0;
    let failedCount = 0;
    const successList: string[] = [];
    const errors: Array<{ line: string; error: string }> = [];

    const teamPlayers = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, currentDkp: true, totalEarned: true, totalSpent: true },
    });

    const playerMap = new Map(teamPlayers.map(p => [p.name, p]));

    for (const line of lines) {
      try {
        const parts = line.split(',').map((s: string) => s.trim());
        
        if (parts.length < 2) {
          failedCount++;
          errors.push({ line, error: '格式错误：至少需要角色名和分数' });
          continue;
        }

        let reason = '';
        let changeValue: number;
        let playerNames: string[] = [];

        let scoreIndex = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
          const num = parseFloat(parts[i]);
          if (!isNaN(num)) {
            scoreIndex = i;
            changeValue = num;
            break;
          }
        }

        if (scoreIndex === -1) {
          failedCount++;
          errors.push({ line, error: '未找到有效分数' });
          continue;
        }

        playerNames = parts.slice(0, scoreIndex);
        
        if (scoreIndex < parts.length - 1) {
          reason = parts.slice(scoreIndex + 1).join(',');
        }

        if (playerNames.length === 0) {
          failedCount++;
          errors.push({ line, error: '未找到角色名' });
          continue;
        }

        for (const playerName of playerNames) {
          const player = playerMap.get(playerName);
          
          if (!player) {
            failedCount++;
            errors.push({ 
              line: `${playerName},${changeValue!}${reason ? ',' + reason : ''}`, 
              error: `玩家不存在: ${playerName}` 
            });
            continue;
          }

          const operationType = changeValue! >= 0 ? 'earn' : 'spend';
          const newDkp = player.currentDkp + changeValue!;
          const newEarned = changeValue! > 0 ? player.totalEarned + changeValue! : player.totalEarned;
          const newSpent = changeValue! < 0 ? player.totalSpent + Math.abs(changeValue!) : player.totalSpent;

          await prisma.$transaction([
            prisma.player.update({
              where: { id: player.id },
              data: {
                currentDkp: newDkp,
                totalEarned: newEarned,
                totalSpent: newSpent,
              },
            }),
            prisma.dkpLog.create({
              data: {
                playerId: player.id,
                teamId,
                type: operationType,
                change: changeValue!,
                reason: reason || `批量导入 - ${changeValue! >= 0 ? '获得' : '消耗'}`,
                operator: session.username || 'admin',
              },
            }),
          ]);

          successCount++;
          successList.push(
            `${playerName}: ${changeValue! >= 0 ? '+' : ''}${changeValue!}${reason ? ' (' + reason + ')' : ''}`
          );
        }
      } catch (error: any) {
        failedCount++;
        errors.push({ 
          line: line.substring(0, 50), 
          error: error.message 
        });
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      successList,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}