import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFaultKeywordNames } from '@/lib/faultKeywords';

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

    const faultKeywords = await fetchFaultKeywordNames(teamId);
    if (faultKeywords.length === 0) {
      return NextResponse.json({ items: [], keywords: [] });
    }

    const logs = await prisma.dkpLog.findMany({
      where: {
        teamId,
        isDeleted: false,
        createdAt: { gte: prevWeekStart },
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
        playerClass: string;
        totalCount: number;
        totalScore: number;
        weeks: Record<WeekBucket, { count: number; score: number }>;
      }
    >();

    const getBucket = (time: Date): WeekBucket | null => {
      if (time >= currentWeekStart) return 'current';
      if (time >= lastWeekStart) return 'last';
      if (time >= prevWeekStart) return 'prev';
      return null;
    };

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
      if (!bucket) {
        continue;
      }

      const player = log.player;
      if (!player) {
        continue;
      }

      if (!stats.has(player.id)) {
        stats.set(player.id, {
          playerId: player.id,
          playerName: player.name,
          playerClass: player.class,
          totalCount: 0,
          totalScore: 0,
          weeks: {
            current: { count: 0, score: 0 },
            last: { count: 0, score: 0 },
            prev: { count: 0, score: 0 },
          },
        });
      }

      const entry = stats.get(player.id)!;
      entry.totalCount += 1;
      entry.totalScore += effectiveChange;
      entry.weeks[bucket].count += 1;
      entry.weeks[bucket].score += effectiveChange;
    }

    const items = Array.from(stats.values()).sort((a, b) => {
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
      return a.totalScore - b.totalScore;
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
