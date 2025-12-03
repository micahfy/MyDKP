import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/teams/basic - 获取基本团队列表（访客用，不含统计数据）
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        // 不查询 _count，节省数据库查询
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    
    // 设置缓存头，访客数据可以缓存更长时间
    const response = NextResponse.json(teams);
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return response;
  } catch (error) {
    console.error('GET /api/teams/basic error:', error);
    return NextResponse.json(
      { error: '获取团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
