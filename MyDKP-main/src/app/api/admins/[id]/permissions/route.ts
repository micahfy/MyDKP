import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { saveAdminPermissions } from '@/lib/adminPermissions';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const payload = await request.json();
    const saved = await saveAdminPermissions(String(params.id || ''), {
      rootAccess: payload.rootAccess === true,
      serverAccesses: Array.isArray(payload.serverAccesses) ? payload.serverAccesses : [],
      guildAccesses: Array.isArray(payload.guildAccesses) ? payload.guildAccesses : [],
      teamIds: Array.isArray(payload.teamIds) ? payload.teamIds : [],
    });

    return NextResponse.json({ success: true, permissions: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存授权失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
