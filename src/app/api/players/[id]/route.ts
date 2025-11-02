import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

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
    const data = await request.json();
    const player = await prisma.player.update({
      where: { id: params.id },
      data,
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
    await prisma.player.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}