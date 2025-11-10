import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 添加缓存控制
export const revalidate = 30; // 30秒缓存

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const search = searchParams.get('search');
    const classFilter = searchParams.get('class');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!teamId) {
      return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
    }

    const where: any = { teamId };
    
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (classFilter && classFilter !== '全部') {
      where.class = classFilter;
    }

    // 并行查询总数和数据
    const [players, total] = await Promise.all([
      prisma.player.findMany({
        where,
        orderBy: { currentDkp: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          class: true,
          currentDkp: true,
          totalEarned: true,
          totalSpent: true,
          attendance: true,
          teamId: true,
          team: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.player.count({ where }),
    ]);

    const response = NextResponse.json({
      players,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });

    // 添加缓存头
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    console.error('Get players error:', error);
    return NextResponse.json({ error: '获取玩家失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const player = await prisma.player.create({ data });
    return NextResponse.json(player);
  } catch (error) {
    return NextResponse.json({ error: '创建玩家失败' }, { status: 500 });
  }
}