import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/teams/basic
export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        serverName: true,
        guildName: true,
        slug: true,
        description: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const response = NextResponse.json(teams);
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (error) {
    console.error('GET /api/teams/basic error:', error);
    return NextResponse.json(
      { error: '获取团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
