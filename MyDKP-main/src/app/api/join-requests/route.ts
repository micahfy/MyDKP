import { NextRequest, NextResponse } from 'next/server';
import { createJoinRequest, listJoinRequests } from '@/lib/joinRequests';
import { isSuperAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get('status') || '').trim();
    const requests = await listJoinRequests(status || undefined);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('list join requests error:', error);
    return NextResponse.json({ error: '获取申请列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const created = await createJoinRequest({
      serverName: String(payload.serverName || ''),
      guildName: String(payload.guildName || ''),
      teamName: String(payload.teamName || ''),
      requestedUsername: String(payload.requestedUsername || ''),
      password: String(payload.password || ''),
      email: String(payload.email || ''),
      verificationCode: String(payload.verificationCode || ''),
    });

    return NextResponse.json({
      success: true,
      requestId: created.id,
      message: '申请已提交，等待超级管理员审批。',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交申请失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
