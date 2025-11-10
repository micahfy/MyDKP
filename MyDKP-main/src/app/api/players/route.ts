import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const search = searchParams.get('search');
    const classFilter = searchParams.get('class');

    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (search) {
      where.name = { contains: search };
    }
    if (classFilter) where.class = classFilter;

    const players = await prisma.player.findMany({
      where,
      orderBy: { currentDkp: 'desc' },
      include: {
        team: { select: { name: true } },
      },
    });

    const response = NextResponse.json(players);
    
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