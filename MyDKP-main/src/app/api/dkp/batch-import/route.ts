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
        // 统一使用 ISO 格式
        const year = logDate.getFullYear();
        const month = String(logDate.getMonth() + 1).padStart(2, '0');
        const day = String(logDate.getDate()).padStart(2, '0');
        const hour = String(logDate.getHours()).padStart(2, '0');
        const minute = String(logDate.getMinutes()).padStart(2, '0');
        const second = String(logDate.getSeconds()).padStart(2, '0');
        
        const logDateStr = `${year}-${month}-${day}`;
        const logTimeStr = `${hour}:${minute}:${second}`;
        
        const hash = generateRecordHash(
          log.player.name,
          log.change,
          log.reason || '',
          logDateStr,
          logTimeStr
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
        
        // 生成标准化的日期时间字符串用于去重
        let dateStr = parts[3] || '';
        let timeStr = parts[4] || '';
        
        // 如果没有提供日期时间，使用当前时间
        if (!dateStr || !timeStr) {
          const now = new Date();
          dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
          timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
        }

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
          // 支持多种日期格式：2024/12/20, 2024-12-20, 2024年12月20日
          const dateParts = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
          // 支持多种时间格式：20:30:45, 20:30, 20时30分45秒, 20时30分
          const timeParts = timeStr.match(/(\d{1,2})[:\时](\d{1,2})(?:[:\分](\d{1,2}))?/);
          
          if (dateParts && timeParts) {
            const year = parseInt(dateParts[1]);
            const month = parseInt(dateParts[2]) - 1; // 月份从0开始
            const day = parseInt(dateParts[3]);
            const hour = parseInt(timeParts[1]);
            const minute = parseInt(timeParts[2]);
            const second = timeParts[3] ? parseInt(timeParts[3]) : 0; // 秒数可选
            recordTime = new Date(year, month, day, hour, minute, second);
            
            // 标准化日期时间字符串用于去重（统一格式）
            dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
          } else {
            // 如果解析失败，使用当前时间
            recordTime = new Date();
            dateStr = recordTime.toISOString().split('T')[0];
            timeStr = recordTime.toTimeString().split(' ')[0];
          }
        } catch (error) {
          recordTime = new Date();
          dateStr = recordTime.toISOString().split('T')[0];
          timeStr = recordTime.toTimeString().split(' ')[0];
        }

        const operationType = changeValue >= 0 ? 'earn' : 'spend';
        const newDkp = player.currentDkp + changeValue;
        const newEarned = changeValue > 0 ? player.totalEarned + changeValue : player.totalEarned;
        const newSpent = changeValue < 0 ? player.totalSpent + Math.abs(changeValue) : player.totalSpent;

        // 先更新玩家数据
        const updatedPlayer = await prisma.player.update({
          where: { id: player.id },
          data: {
            currentDkp: newDkp,
            totalEarned: newEarned,
            totalSpent: newSpent,
          },
        });

        // 再创建日志
        await prisma.dkpLog.create({
          data: {
            playerId: player.id,
            teamId,
            type: operationType,
            change: changeValue,
            reason: reason || `批量导入 - ${changeValue >= 0 ? '获得' : '消耗'}`,
            operator: session.username || 'admin',
            createdAt: recordTime,
          },
        });

        // 更新内存中的玩家数据，供后续操作使用
        player.currentDkp = updatedPlayer.currentDkp;
        player.totalEarned = updatedPlayer.totalEarned;
        player.totalSpent = updatedPlayer.totalSpent;

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