import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const playerId = searchParams.get('playerId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (playerId) where.playerId = playerId;

    const logs = await prisma.dkpLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        player: { select: { name: true } },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: '获取日志失败' }, { status: 500 });
  }
}