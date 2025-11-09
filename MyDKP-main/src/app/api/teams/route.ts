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
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    
    return NextResponse.json(teams);
  } catch (error) {
    console.error('GET /api/teams error:', error);
    return NextResponse.json(
      { error: '获取团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json(
        { error: '权限不足，请先登录管理员账号' },
        { status: 403 }
      );
    }

    const { name, description } = await request.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: '团队名称不能为空' },
        { status: 400 }
      );
    }

    // 检查名称是否已存在
    const existingTeam = await prisma.team.findUnique({
      where: { name: name.trim() },
    });

    if (existingTeam) {
      return NextResponse.json(
        { error: '团队名称已存在' },
        { status: 409 }
      );
    }
    
    // 获取当前最大 sortOrder
    const maxSortOrder = await prisma.team.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    
    const team = await prisma.team.create({
      data: { 
        name: name.trim(), 
        description: description?.trim() || null,
        sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
      },
    });
    
    return NextResponse.json(team);
  } catch (error) {
    console.error('POST /api/teams error:', error);
    
    // Prisma unique constraint violation
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: '团队名称已存在' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: '创建团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}