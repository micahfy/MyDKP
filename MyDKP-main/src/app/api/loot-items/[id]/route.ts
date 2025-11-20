import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    if (!params?.id) {
      return NextResponse.json({ error: '缺少 ID' }, { status: 400 });
    }

    await prisma.lootItem.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/loot-items error:', error);
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
