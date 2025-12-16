import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const player = await prisma.player.findUnique({
      where: { id: params.id },
      include: { team: true },
    });

    if (!player) {
      return NextResponse.json({ error: '玩家不存在' }, { status: 404 });
    }

    return NextResponse.json(player);
  } catch (error) {
    return NextResponse.json({ error: '获取玩家失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    // 先获取玩家信息以检查团队权限
    const existingPlayer = await prisma.player.findUnique({
      where: { id: params.id },
      select: { teamId: true },
    });

    if (!existingPlayer) {
      return NextResponse.json({ error: '玩家不存在' }, { status: 404 });
    }

    // 检查团队权限
    const hasPermission = await hasTeamPermission(existingPlayer.teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队的玩家' }, { status: 403 });
    }

    const data = await request.json();
    const updateData: any = { ...data };
    if (typeof data.isArchived === 'boolean') {
      updateData.archivedAt = data.isArchived ? new Date() : null;
    }
    const player = await prisma.player.update({
      where: { id: params.id },
      data: updateData,
    });
    return NextResponse.json(player);
  } catch (error) {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    // 先获取玩家信息以检查团队权限
    const existingPlayer = await prisma.player.findUnique({
      where: { id: params.id },
      select: { teamId: true },
    });

    if (!existingPlayer) {
      return NextResponse.json({ error: '玩家不存在' }, { status: 404 });
    }

    // 检查团队权限
    const hasPermission = await hasTeamPermission(existingPlayer.teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队的玩家' }, { status: 403 });
    }

    await prisma.player.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
