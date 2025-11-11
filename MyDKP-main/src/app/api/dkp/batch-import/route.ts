import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 生成唯一标识用于去重
function generateRecordHash(playerName: string, change: number, reason: string, date: string, time: string): string {
  return `${playerName}-${change}-${reason}-${date}-${time}`;
}

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { teamId, importData, ignoreDuplicates = true } = await request.json();

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
    let duplicateCount = 0;
    const successList: string[] = [];
    const errors: Array<{ line: string; error: string }> = [];

    const teamPlayers = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, currentDkp: true, totalEarned: true, totalSpent: true },
    });

    const playerMap = new Map(teamPlayers.map(p => [p.name, p]));

    // 用于去重的集合
    const processedHashes = new Set<string>();
    
    // 如果需要检查历史记录去重，先获取最近的记录
    let existingHashes = new Set<string>();
    if (ignoreDuplicates) {
      const recentLogs = await prisma.dkpLog.findMany({
        where: { 
          teamId,
          createdAt: {
            // 只检查最近30天的记录，提高性能
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          player: {
            select: { name: true }
          }
        }
      });

      // 构建已存在记录的哈希集合
      for (const log of recentLogs) {
        const logDate = new Date(log.createdAt);
        const dateStr = logDate.toLocaleDateString('zh-CN');
        const timeStr = logDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        const hash = generateRecordHash(
          log.player.name,
          log.change,
          log.reason || '',
          dateStr,
          timeStr
        );
        existingHashes.add(hash);
      }
    }

    for (const line of lines) {
      try {
        const parts = line.split(',').map((s: string) => s.trim());
        
        if (parts.length < 3) {
          failedCount++;
          errors.push({ line, error: '格式错误：至少需要角色名、分数和原因' });
          continue;
        }

        // 解析格式：玩家,分数,原因,日期,时间
        const playerName = parts[0];
        const changeValue = parseFloat(parts[1]);
        const reason = parts[2] || '';
        const dateStr = parts[3] || new Date().toLocaleDateString('zh-CN');
        const timeStr = parts[4] || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        if (!playerName) {
          failedCount++;
          errors.push({ line, error: '角色名不能为空' });
          continue;
        }

        if (isNaN(changeValue)) {
          failedCount++;
          errors.push({ line, error: '分数必须是有效数字' });
          continue;
        }

        // 生成记录哈希用于去重
        const recordHash = generateRecordHash(playerName, changeValue, reason, dateStr, timeStr);

        // 检查是否重复（当前批次内）
        if (processedHashes.has(recordHash)) {
          duplicateCount++;
          continue;
        }

        // 检查是否与历史记录重复
        if (ignoreDuplicates && existingHashes.has(recordHash)) {
          duplicateCount++;
          continue;
        }

        const player = playerMap.get(playerName);
        
        if (!player) {
          failedCount++;
          errors.push({ 
            line: `${playerName},${changeValue},${reason},${dateStr},${timeStr}`, 
            error: `玩家不存在: ${playerName}` 
          });
          continue;
        }

        // 解析日期时间
        let recordTime: Date;
        try {
          // 尝试解析日期时间
          const dateParts = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
          const timeParts = timeStr.match(/(\d{1,2})[:\时](\d{1,2})/);
          
          if (dateParts && timeParts) {
            const year = parseInt(dateParts[1]);
            const month = parseInt(dateParts[2]) - 1; // 月份从0开始
            const day = parseInt(dateParts[3]);
            const hour = parseInt(timeParts[1]);
            const minute = parseInt(timeParts[2]);
            recordTime = new Date(year, month, day, hour, minute);
          } else {
            // 如果解析失败，使用当前时间
            recordTime = new Date();
          }
        } catch (error) {
          recordTime = new Date();
        }

        const operationType = changeValue >= 0 ? 'earn' : 'spend';
        const newDkp = player.currentDkp + changeValue;
        const newEarned = changeValue > 0 ? player.totalEarned + changeValue : player.totalEarned;
        const newSpent = changeValue < 0 ? player.totalSpent + Math.abs(changeValue) : player.totalSpent;

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
              change: changeValue,
              reason: reason || `批量导入 - ${changeValue >= 0 ? '获得' : '消耗'}`,
              operator: session.username || 'admin',
              createdAt: recordTime, // 使用指定的时间
            },
          }),
        ]);

        processedHashes.add(recordHash);
        successCount++;
        successList.push(
          `${playerName}: ${changeValue >= 0 ? '+' : ''}${changeValue} ${reason ? '(' + reason + ')' : ''} [${dateStr} ${timeStr}]`
        );
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
      duplicate: duplicateCount,
      successList,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}