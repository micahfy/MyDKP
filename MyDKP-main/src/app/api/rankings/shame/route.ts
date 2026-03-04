import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFaultKeywordNames } from '@/lib/faultKeywords';
import { maskSensitiveTextForDisplay } from '@/lib/sensitiveKeywords';

export const dynamic = 'force-dynamic';

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, '');

const matchesFaultKeyword = (reason: string, keywords: string[]) => {
  const normalized = normalizeText(reason);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date: Date) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

type WeekBucket = 'current' | 'last' | 'prev';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
    }

    const now = new Date();
    const currentWeekStart = startOfWeek(now);
    const lastWeekStart = addDays(currentWeekStart, -7);
    const prevWeekStart = addDays(currentWeekStart, -14);
    const currentMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(addDays(currentMonthStart, -1));
    const timeQueryStart = prevWeekStart < lastMonthStart ? prevWeekStart : lastMonthStart;

    const faultKeywords = await fetchFaultKeywordNames(teamId);
    if (faultKeywords.length === 0) {
      return NextResponse.json({ items: [], keywords: [] });
    }

    const logs = await prisma.dkpLog.findMany({
      where: {
        teamId,
        isDeleted: false,
        createdAt: { gte: timeQueryStart },
        OR: [
          { change: { lt: 0 } },
          { event: { is: { change: { lt: 0 } } } },
        ],
      },
      include: {
        player: { select: { id: true, name: true, class: true } },
        event: { select: { change: true, reason: true, eventTime: true } },
      },
    });

    const stats = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        playerDisplayName: string;
        playerClass: string;
        totalCount: number;
        totalScore: number;
        lastMonthCount: number;
        lastMonthScore: number;
        weeks: Record<WeekBucket, { count: number; score: number }>;
      }
    >();

    const getBucket = (time: Date): WeekBucket | null => {
      if (time >= currentWeekStart) return 'current';
      if (time >= lastWeekStart) return 'last';
      if (time >= prevWeekStart) return 'prev';
      return null;
    };

    const isInLastMonth = (time: Date) => time >= lastMonthStart && time < currentMonthStart;

    for (const log of logs) {
      const reason = (log.reason ?? log.event?.reason ?? '').trim();
      if (!reason || !matchesFaultKeyword(reason, faultKeywords)) {
        continue;
      }

      const effectiveChange = log.change ?? log.event?.change ?? 0;
      if (effectiveChange >= 0) {
        continue;
      }

      const logTime = log.event?.eventTime ?? log.createdAt;
      const bucket = getBucket(logTime);

      const player = log.player;
      if (!player) {
        continue;
      }

      if (!stats.has(player.id)) {
        stats.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          playerDisplayName: maskSensitiveTextForDisplay(player.name),
          playerClass: player.class,
          totalCount: 0,
          totalScore: 0,
          lastMonthCount: 0,
          lastMonthScore: 0,
          weeks: {
            current: { count: 0, score: 0 },
            last: { count: 0, score: 0 },
            prev: { count: 0, score: 0 },
          },
        });
      }

      const entry = stats.get(player.id)!;
      if (bucket) {
        entry.totalCount += 1;
        entry.totalScore += effectiveChange;
        entry.weeks[bucket].count += 1;
        entry.weeks[bucket].score += effectiveChange;
      }
      if (isInLastMonth(logTime)) {
        entry.lastMonthCount += 1;
        entry.lastMonthScore += effectiveChange;
      }
    }

    const items = Array.from(stats.values())
      .filter((entry) => entry.totalCount > 0 || entry.lastMonthCount > 0)
      .sort((a, b) => {
        if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
        if (b.lastMonthCount !== a.lastMonthCount) return b.lastMonthCount - a.lastMonthCount;
        if (a.totalScore !== b.totalScore) return a.totalScore - b.totalScore;
        return a.playerName.localeCompare(b.playerName, 'zh-CN');
      });

    return NextResponse.json({
      items,
      keywords: faultKeywords,
    });
  } catch (error) {
    console.error('Get shame ranking error:', error);
    return NextResponse.json({ error: '获取耻辱榜失败' }, { status: 500 });
  }
}
