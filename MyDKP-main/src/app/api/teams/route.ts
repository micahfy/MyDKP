import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: {
        _count: {
          select: { players: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(teams);
  } catch (error) {
    return NextResponse.json({ error: '获取团队失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const { name, description } = await request.json();
    const team = await prisma.team.create({
      data: { name, description },
    });
    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: '创建团队失败' }, { status: 500 });
  }
}