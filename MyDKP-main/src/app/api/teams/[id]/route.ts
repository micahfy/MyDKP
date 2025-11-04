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
    console.error('Get team error:', error);
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
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json(
        { error: '权限不足，请先登录管理员账号' },
        { status: 403 }
      );
    }

    const { name, description } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: '团队名称不能为空' },
        { status: 400 }
      );
    }

    // 检查团队是否存在
    const existingTeam = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!existingTeam) {
      return NextResponse.json(
        { error: '团队不存在' },
        { status: 404 }
      );
    }

    // 检查新名称是否与其他团队冲突
    if (name !== existingTeam.name) {
      const duplicateTeam = await prisma.team.findUnique({
        where: { name },
      });

      if (duplicateTeam) {
        return NextResponse.json(
          { error: '团队名称已存在' },
          { status: 409 }
        );
      }
    }

    const team = await prisma.team.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(team);
  } catch (error: any) {
    console.error('Update team error:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '团队名称已存在' },
        { status: 409 }
      );
    }
    
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
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json(
        { error: '权限不足，请先登录管理员账号' },
        { status: 403 }
      );
    }

    // 检查团队是否存在
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { players: true },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: '团队不存在' },
        { status: 404 }
      );
    }

    await prisma.team.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ 
      success: true,
      message: `已删除团队 ${team.name}，包含 ${team._count.players} 名玩家的所有数据`
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json(
      { error: '删除团队失败' },
      { status: 500 }
    );
  }
}