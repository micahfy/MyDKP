import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function generateRecordHash(playerName: string, change: number, reason: string, date: string, time: string): string {
  return `${playerName}-${change}-${reason}-${date}-${time}`;
}

function pad(num: number) {
  return String(num).padStart(2, '0');
}

function toBeijingParts(date: Date) {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
    hour: beijing.getUTCHours(),
    minute: beijing.getUTCMinutes(),
    second: beijing.getUTCSeconds(),
  };
}

function formatBeijing(date: Date) {
  const parts = toBeijingParts(date);
  return {
    dateStr: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    timeStr: `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
  };
}

function normalizeDateTime(rawDate?: string, rawTime?: string) {
  let dateStr = rawDate?.trim() || '';
  let timeStr = rawTime?.trim() || '';

  if (!dateStr || !timeStr) {
    const now = new Date();
    return {
      recordTime: now,
      ...formatBeijing(now),
    };
  }

  try {
    const dateParts = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
    const timeParts = timeStr.match(/(\d{1,2})[:\时](\d{1,2})(?:[:\分](\d{1,2}))?/);

    if (dateParts && timeParts) {
      const year = parseInt(dateParts[1], 10);
      const month = parseInt(dateParts[2], 10);
      const day = parseInt(dateParts[3], 10);
      const hour = parseInt(timeParts[1], 10);
      const minute = parseInt(timeParts[2], 10);
      const second = timeParts[3] ? parseInt(timeParts[3], 10) : 0;

      const isoDate = `${year}-${pad(month)}-${pad(day)}`;
      const isoTime = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
      const recordTime = new Date(`${isoDate}T${isoTime}+08:00`);

      return {
        recordTime,
        dateStr: isoDate,
        timeStr: isoTime,
      };
    }
  } catch {
    // ignore and fallback to now
  }

  const fallback = new Date();
  return {
    recordTime: fallback,
    ...formatBeijing(fallback),
  };
}

async function updateTeamAttendance(teamId: string) {
  const [logs, players] = await Promise.all([
    prisma.dkpLog.findMany({
      where: { teamId },
      select: { playerId: true, change: true, reason: true, createdAt: true },
    }),
    prisma.player.findMany({
      where: { teamId },
      select: { id: true },
    }),
  ]);

  if (players.length === 0) {
    return;
  }

  const activityDays = new Set<string>();
  const logsByDay = new Map<string, Array<{ playerId: string; change: number }>>();

  for (const log of logs) {
    const { dateStr } = formatBeijing(new Date(log.createdAt));
    if (!logsByDay.has(dateStr)) {
      logsByDay.set(dateStr, []);
    }
    logsByDay.get(dateStr)!.push({ playerId: log.playerId, change: log.change });

    if ((log.reason || '').trim() === '集合分') {
      activityDays.add(dateStr);
    }
  }

  if (activityDays.size === 0) {
    await prisma.player.updateMany({
      where: { teamId },
      data: { attendance: 0 },
    });
    return;
  }

  const attendanceMap = new Map<string, Set<string>>();

  for (const day of activityDays) {
    const dayLogs = logsByDay.get(day);
    if (!dayLogs) continue;

    const presentPlayers = new Set<string>();
    for (const entry of dayLogs) {
      if (entry.change > 0) {
        presentPlayers.add(entry.playerId);
      }
    }

    for (const playerId of presentPlayers) {
      if (!attendanceMap.has(playerId)) {
        attendanceMap.set(playerId, new Set());
      }
      attendanceMap.get(playerId)!.add(day);
    }
  }

  const totalActivities = activityDays.size;

  await Promise.all(
    players.map(({ id }) => {
      const attendedDays = attendanceMap.get(id)?.size ?? 0;
      const attendance = totalActivities === 0 ? 0 : attendedDays / totalActivities;
      return prisma.player.update({
        where: { id },
        data: { attendance },
      });
    }),
  );
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
        const { dateStr: logDateStr, timeStr: logTimeStr } = formatBeijing(new Date(log.createdAt));
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

    await updateTeamAttendance(teamId);

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
