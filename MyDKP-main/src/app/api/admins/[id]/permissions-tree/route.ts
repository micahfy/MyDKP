import { NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { getAdminPermissionTree } from '@/lib/adminPermissions';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const data = await getAdminPermissionTree(String(params.id || ''));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取授权目录失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
