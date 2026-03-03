import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { reviewJoinRequest } from '@/lib/joinRequests';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    if (!session.adminId) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { action, note } = await request.json();
    const normalizedAction = String(action || '').trim();

    if (normalizedAction !== 'approve' && normalizedAction !== 'reject') {
      return NextResponse.json({ error: '无效的审批操作' }, { status: 400 });
    }

    const reviewed = await reviewJoinRequest(
      String(params.id || ''),
      normalizedAction,
      session.adminId,
      String(note || ''),
    );

    return NextResponse.json({ success: true, request: reviewed });
  } catch (error) {
    const message = error instanceof Error ? error.message : '审批失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
