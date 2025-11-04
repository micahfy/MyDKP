import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

// GET /api/teams/[id] - 获取单个团队信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            players: true,
            dkpLogs: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: '团队不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json(
      { error: '获取团队失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/teams/[id] - 更新团队信息
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    const { name, description } = await request.json();

    const team = await prisma.team.update({
      where: { id: params.id },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json(
      { error: '更新团队失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/teams/[id] - 删除团队
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    await prisma.team.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '删除团队失败' },
      { status: 500 }
    );
  }
}