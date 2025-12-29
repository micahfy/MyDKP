import { NextResponse } from 'next/server';
import { hasTeamPermission, isAdmin, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const keyword = await prisma.faultKeyword.findUnique({
      where: { id: params.id },
    });

    if (!keyword) {
      return NextResponse.json({ error: '关键字不存在' }, { status: 404 });
    }

    if (keyword.scope === 'global') {
      if (!(await isSuperAdmin())) {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
    } else if (keyword.teamId) {
      const permitted = await hasTeamPermission(keyword.teamId);
      if (!permitted) {
        return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: '关键字数据异常' }, { status: 400 });
    }

    await prisma.faultKeyword.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete fault keyword error:', error);
    return NextResponse.json({ error: '删除关键字失败' }, { status: 500 });
  }
}
