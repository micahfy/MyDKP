import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function generateRecordHash(playerName: string, change: number, reason: string, date: string, time: string): string {
  return `${playerName}-${change}-${reason}-${date}-${time}`;
}

function normalizeDateTime(rawDate?: string, rawTime?: string) {
  let dateStr = rawDate?.trim() || '';
  let timeStr = rawTime?.trim() || '';

  if (!dateStr || !timeStr) {
    const now = new Date();
    return {
      recordTime: now,
      dateStr: now.toISOString().split('T')[0],
      timeStr: now.toTimeString().split(' ')[0],
    };
  }

  try {
    const dateParts = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
    const timeParts = timeStr.match(/(\d{1,2})[:\时](\d{1,2})(?:[:\分](\d{1,2}))?/);

    if (dateParts && timeParts) {
      const year = parseInt(dateParts[1]);
      const month = parseInt(dateParts[2]) - 1;
      const day = parseInt(dateParts[3]);
      const hour = parseInt(timeParts[1]);
      const minute = parseInt(timeParts[2]);
      const second = timeParts[3] ? parseInt(timeParts[3]) : 0;

      const recordTime = new Date(year, month, day, hour, minute, second);

      return {
        recordTime,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      };
    }
  } catch {
    // ignore and fallback to now
  }

  const fallback = new Date();
  return {
    recordTime: fallback,
    dateStr: fallback.toISOString().split('T')[0],
    timeStr: fallback.toTimeString().split(' ')[0],
  };
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

    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const lines = importData
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const successList: string[] = [];
    const errors: Array<{ line: string; error: string }> = [];

    const teamPlayers = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, currentDkp: true, totalEarned: true, totalSpent: true },
    });

    const playerMap = new Map(teamPlayers.map((p) => [p.name, p]));
    const processedHashes = new Set<string>();
    const existingHashes = new Set<string>();

    if (ignoreDuplicates) {
      const recentLogs = await prisma.dkpLog.findMany({
        where: {
          teamId,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          player: { select: { name: true } },
        },
      });

      for (const log of recentLogs) {
        const logDate = new Date(log.createdAt);
        const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(
          logDate.getDate(),
        ).padStart(2, '0')}`;
        const logTimeStr = `${String(logDate.getHours()).padStart(2, '0')}:${String(logDate.getMinutes()).padStart(2, '0')}:${String(
          logDate.getSeconds(),
        ).padStart(2, '0')}`;

        const hash = generateRecordHash(log.player.name, log.change, (log.reason || '').trim(), logDateStr, logTimeStr);
        existingHashes.add(hash);
      }
    }

    for (const line of lines) {
      try {
        const parts = line.split(',').map((s) => s.trim());

        if (parts.length < 3) {
          failedCount++;
          errors.push({ line, error: '格式错误：至少需要角色名、分数和原因' });
          continue;
        }

        const playerName = (parts[0] || '').trim();
        const changeValue = parseFloat(parts[1]);
        const rawReason = parts[2] ?? '';
        const trimmedReason = rawReason.trim();

        if (!playerName) {
          failedCount++;
          errors.push({ line, error: '角色名不能为空' });
          continue;
        }

        if (Number.isNaN(changeValue)) {
          failedCount++;
          errors.push({ line, error: '分数必须是有效数字' });
          continue;
        }

        const { recordTime, dateStr, timeStr } = normalizeDateTime(parts[3], parts[4]);
        const finalReason = trimmedReason || `批量导入 - ${changeValue >= 0 ? '获得' : '消耗'}`;
        const recordHash = generateRecordHash(playerName, changeValue, finalReason, dateStr, timeStr);

        if (processedHashes.has(recordHash)) {
          duplicateCount++;
          continue;
        }

        if (ignoreDuplicates && existingHashes.has(recordHash)) {
          duplicateCount++;
          continue;
        }

        const player = playerMap.get(playerName);

        if (!player) {
          failedCount++;
          errors.push({
            line: `${playerName},${changeValue},${finalReason},${dateStr},${timeStr}`,
            error: `玩家不存在 ${playerName}`,
          });
          continue;
        }

        const operationType = changeValue >= 0 ? 'earn' : 'spend';
        const newDkp = player.currentDkp + changeValue;
        const newEarned = changeValue > 0 ? player.totalEarned + changeValue : player.totalEarned;
        const newSpent = changeValue < 0 ? player.totalSpent + Math.abs(changeValue) : player.totalSpent;

        const updatedPlayer = await prisma.player.update({
          where: { id: player.id },
          data: {
            currentDkp: newDkp,
            totalEarned: newEarned,
            totalSpent: newSpent,
          },
        });

        await prisma.dkpLog.create({
          data: {
            playerId: player.id,
            teamId,
            type: operationType,
            change: changeValue,
            reason: finalReason,
            operator: session.username || 'admin',
            createdAt: recordTime,
          },
        });

        player.currentDkp = updatedPlayer.currentDkp;
        player.totalEarned = updatedPlayer.totalEarned;
        player.totalSpent = updatedPlayer.totalSpent;

        processedHashes.add(recordHash);
        successCount++;
        successList.push(
          `${playerName}: ${changeValue >= 0 ? '+' : ''}${changeValue} ${trimmedReason ? '(' + trimmedReason + ')' : ''} [${dateStr} ${timeStr}]`,
        );
      } catch (error: any) {
        failedCount++;
        errors.push({ line: line.substring(0, 50), error: error?.message || '未知错误' });
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
