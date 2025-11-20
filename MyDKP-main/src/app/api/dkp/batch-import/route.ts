import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';
import { recalculateTeamAttendance } from '@/lib/attendance';
import { applyLootHighlight, fetchLootItems, normalizeReason } from '@/lib/loot';

export const dynamic = 'force-dynamic';

const DUPLICATE_LOOKBACK_DAYS = 30;

function generateRecordHash(playerName: string, change: number, reason: string, date: string, time: string): string {
  return `${playerName}-${change}-${normalizeReason(reason)}-${date}-${time}`;
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
  const dateStr = rawDate?.trim() ?? '';
  const timeStr = rawTime?.trim() ?? '';

  if (!dateStr || !timeStr) {
    const now = new Date();
    return {
      recordTime: now,
      ...formatBeijing(now),
    };
  }

  const dateParts = dateStr.match(/(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})/);
  const timeParts = timeStr.match(/(\d{1,2})[:时](\d{1,2})(?:[:分](\d{1,2}))?/);

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

  const fallback = new Date();
  return {
    recordTime: fallback,
    ...formatBeijing(fallback),
  };
}

async function collectExistingHashes(teamId: string) {
  const cutoff = new Date(Date.now() - DUPLICATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const recentLogs = await prisma.dkpLog.findMany({
      where: {
        teamId,
        isDeleted: false,
        createdAt: { gte: cutoff },
      },
    include: {
      player: { select: { name: true } },
    },
  });

  const hashes = new Set<string>();

  for (const log of recentLogs) {
    const { dateStr, timeStr } = formatBeijing(new Date(log.createdAt));
    hashes.add(generateRecordHash(log.player.name, log.change, log.reason || '', dateStr, timeStr));
  }

  return hashes;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
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
      .filter((line: string) => line && !line.startsWith('#'));

    let successCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const successList: string[] = [];
    const errors: Array<{ line: string; error: string }> = [];

    const teamPlayers = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, name: true, currentDkp: true, totalEarned: true, totalSpent: true },
    });
    const playerMap = new Map(teamPlayers.map((player) => [player.name, { ...player }]));

    const lootItems = await fetchLootItems();
    const processedHashes = new Set<string>();
    const existingHashes = ignoreDuplicates ? await collectExistingHashes(teamId) : new Set<string>();

    for (const line of lines) {
      try {
        const parts = line.split(',').map((part: string) => part.trim());

        if (parts.length < 3) {
          failedCount++;
          errors.push({ line, error: '格式错误：至少需要包含角色名、分数与原因' });
          continue;
        }

        const [playerNameRaw, changeRaw, reasonRaw, dateRaw, timeRaw] = parts;
        const playerName = playerNameRaw?.trim() ?? '';
        const changeValue = parseFloat(changeRaw);
        const trimmedReason = reasonRaw?.trim() ?? '';

        if (!playerName) {
          failedCount++;
          errors.push({ line, error: '角色名不能为空' });
          continue;
        }

        if (Number.isNaN(changeValue)) {
          failedCount++;
          errors.push({ line, error: '分数不是有效数字' });
          continue;
        }

        const player = playerMap.get(playerName);
        if (!player) {
          failedCount++;
          errors.push({ line, error: `未找到角色：${playerName}` });
          continue;
        }

        const { recordTime, dateStr, timeStr } = normalizeDateTime(dateRaw, timeRaw);
        const baseReason = trimmedReason || `批量导入 - ${changeValue >= 0 ? '奖励' : '扣分'}`;
        const highlightedReason = applyLootHighlight(baseReason, lootItems);
        const recordHash = generateRecordHash(playerName, changeValue, baseReason, dateStr, timeStr);

        if (processedHashes.has(recordHash) || existingHashes.has(recordHash)) {
          duplicateCount++;
          continue;
        }

        const operationType = changeValue >= 0 ? 'earn' : 'spend';

        await prisma.$transaction(async (tx) => {
          const updatedPlayer = await tx.player.update({
            where: { id: player.id },
            data: {
              currentDkp: { increment: changeValue },
              ...(changeValue > 0
                ? { totalEarned: { increment: changeValue } }
                : {}),
              ...(changeValue < 0
                ? { totalSpent: { increment: Math.abs(changeValue) } }
                : {}),
            },
          });

          await tx.dkpLog.create({
            data: {
              playerId: player.id,
              teamId,
              type: operationType,
              change: changeValue,
              reason: highlightedReason,
              operator: session.username || 'admin',
              createdAt: recordTime,
            },
          });

          player.currentDkp = updatedPlayer.currentDkp;
          player.totalEarned = updatedPlayer.totalEarned;
          player.totalSpent = updatedPlayer.totalSpent;
        });

        processedHashes.add(recordHash);
        successCount++;
        successList.push(
          `${playerName}: ${changeValue >= 0 ? '+' : ''}${changeValue} ${trimmedReason ? `(${trimmedReason})` : ''} [${dateStr} ${timeStr}]`
        );
      } catch (error: any) {
        failedCount++;
        errors.push({ line: line.substring(0, 80), error: error?.message || '未知错误' });
      }
    }

    await recalculateTeamAttendance(teamId);

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
