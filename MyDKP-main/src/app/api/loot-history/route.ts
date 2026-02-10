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

    // 查询装备消费记录（type='spend'表示支出，即装备消费）
    const logs = await prisma.dkpLog.findMany({
      where: {
        teamId: team.id,
        type: 'spend',
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

    // 从item字段或reason字段中提取装备名称
    const EQUIP_REGEX = /\[([^\]]+)\]/g;

    const validLogs = logs.filter(log => {
      // 优先使用item字段
      if (log.item && log.item.trim() !== '') {
        return true;
      }
      // 如果item为空，尝试从reason中提取装备名称
      if (log.reason) {
        const matches = log.reason.match(EQUIP_REGEX);
        return matches && matches.length > 0;
      }
      return false;
    }).map(log => {
      // 确定装备名称
      let itemName = log.item || '';
      if (!itemName && log.reason) {
        const matches = log.reason.match(EQUIP_REGEX);
        if (matches && matches.length > 0) {
          // 提取第一个装备名称（去掉方括号）
          itemName = matches[0].slice(1, -1);
        }
      }
      return {
        ...log,
        extractedItemName: itemName
      };
    });

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
      const itemName = (log as any).extractedItemName;
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

    // 按平均价格降序排序（从高到低）
    items.sort((a, b) => b.avgPrice - a.avgPrice);

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
