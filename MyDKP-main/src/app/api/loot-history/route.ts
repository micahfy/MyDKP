import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LootHistoryResponse } from '@/types/loot';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamSlug = searchParams.get('teamSlug');
    const weeks = parseInt(searchParams.get('weeks') || '8');

    // 验证参数
    if (!teamSlug) {
      return NextResponse.json(
        { error: '缺少 teamSlug 参数' },
        { status: 400 }
      );
    }

    if (weeks < 1 || weeks > 52) {
      return NextResponse.json(
        { error: 'weeks 参数必须在 1-52 之间' },
        { status: 400 }
      );
    }

    // 根据 teamSlug 查询团队
    const team = await prisma.team.findUnique({
      where: { slug: teamSlug },
      select: { id: true, name: true }
    });

    if (!team) {
      return NextResponse.json(
        { error: '未找到该团队' },
        { status: 404 }
      );
    }

    // 计算时间范围
    const now = new Date();
    const weeksAgo = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    // 查询装备消费记录
    const logs = await prisma.dkpLog.findMany({
      where: {
        teamId: team.id,
        type: 'spend',
        item: {
          not: null
        },
        isDeleted: false,
        createdAt: {
          gte: weeksAgo,
          lte: now
        }
      },
      include: {
        player: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // 过滤掉空装备名
    const validLogs = logs.filter(log => log.item && log.item.trim() !== '');

    if (validLogs.length === 0) {
      return NextResponse.json({
        items: [],
        teamName: team.name,
        timeRange: {
          start: weeksAgo.toISOString(),
          end: now.toISOString()
        }
      } as LootHistoryResponse);
    }

    // 按装备名称分组
    const itemGroups = new Map<string, typeof validLogs>();

    for (const log of validLogs) {
      const itemName = log.item!;
      if (!itemGroups.has(itemName)) {
        itemGroups.set(itemName, []);
      }
      itemGroups.get(itemName)!.push(log);
    }

    // 构建响应数据
    const items = Array.from(itemGroups.entries()).map(([itemName, logs]) => {
      const priceHistory = logs.map(log => ({
        timestamp: log.createdAt.toISOString(),
        price: Math.abs(log.change || 0),
        player: log.player.name,
        date: log.createdAt.toISOString().split('T')[0]
      }));

      const prices = priceHistory.map(p => p.price);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      return {
        itemName,
        dropCount: logs.length,
        priceHistory,
        avgPrice: Math.round(avgPrice * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100
      };
    });

    // 按掉落次数降序排序
    items.sort((a, b) => b.dropCount - a.dropCount);

    const response: LootHistoryResponse = {
      items,
      teamName: team.name,
      timeRange: {
        start: weeksAgo.toISOString(),
        end: now.toISOString()
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('GET /api/loot-history error:', error);
    return NextResponse.json(
      {
        error: '获取装备历史失败',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
