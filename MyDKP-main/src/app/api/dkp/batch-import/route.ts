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
    const { teamId, importData, operationType } = await request.json();

    if (!teamId || !importData) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const lines = importData.split('\n').filter((line: string) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    // 获取团队所有玩家用于匹配
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
          errors.push(`格式错误: ${line}`);
          continue;
        }

        // 从后往前解析：最后一个是原因（可选），倒数第二个是分数，之前的都是角色名
        let reason = '';
        let changeValue: number;
        let playerNames: string[] = [];

        // 尝试找到分数字段（从后往前第一个能转为数字的）
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
          errors.push(`未找到有效分数: ${line}`);
          continue;
        }

        // 分数之前的都是角色名
        playerNames = parts.slice(0, scoreIndex);
        
        // 分数之后的是原因
        if (scoreIndex < parts.length - 1) {
          reason = parts.slice(scoreIndex + 1).join(',');
        }

        if (playerNames.length === 0) {
          failedCount++;
          errors.push(`未找到角色名: ${line}`);
          continue;
        }

        // 根据操作类型调整分数符号
        if (operationType === 'spend' || operationType === 'penalty') {
          changeValue = -Math.abs(changeValue!);
        } else {
          changeValue = Math.abs(changeValue!);
        }

        // 为每个玩家创建记录
        for (const playerName of playerNames) {
          const player = playerMap.get(playerName);
          
          if (!player) {
            failedCount++;
            errors.push(`玩家不存在: ${playerName}`);
            continue;
          }

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
                reason: reason || `批量导入 - ${operationType}`,
                operator: session.username || 'admin',
              },
            }),
          ]);

          successCount++;
        }
      } catch (error: any) {
        failedCount++;
        errors.push(`处理失败: ${line.substring(0, 50)} - ${error.message}`);
      }
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      errors: errors.slice(0, 20), // 只返回前20个错误
    });
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}