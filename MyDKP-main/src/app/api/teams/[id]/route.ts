import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/auth';
export const dynamic = 'force-dynamic';
// GET /api/teams/[id] - 获取单个团队信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
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

// PATCH /api/teams/[id] - 更新团队信息（仅超管）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 只有超级管理员可以修改团队
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以修改团队' },
        { status: 403 }
      );
    }

    const { name, description, slug } = await request.json();

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

    if (slug && slug.trim().length > 0 && slug !== existingTeam.slug) {
      const duplicateSlug = await prisma.team.findUnique({
        where: { slug },
      });
      if (duplicateSlug) {
        return NextResponse.json({ error: '短链接已被占用' }, { status: 409 });
      }
    }

    const team = await prisma.team.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        slug: slug?.trim() || null,
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

// DELETE /api/teams/[id] - 删除团队（仅超管）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 只有超级管理员可以删除团队
    if (!(await isSuperAdmin())) {
      return NextResponse.json(
        { error: '权限不足，只有超级管理员可以删除团队' },
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
