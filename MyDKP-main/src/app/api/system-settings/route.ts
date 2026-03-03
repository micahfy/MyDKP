import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import {
  getJoinRequestNotifyEmail,
  JOIN_REQUEST_NOTIFY_EMAIL_KEY,
  setSystemSetting,
} from '@/lib/systemSettings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const joinRequestNotifyEmail = await getJoinRequestNotifyEmail();
    return NextResponse.json({
      joinRequestNotifyEmail,
    });
  } catch (error) {
    console.error('get system settings error:', error);
    return NextResponse.json({ error: '获取系统设置失败' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { joinRequestNotifyEmail } = await request.json();
    const email = String(joinRequestNotifyEmail || '').trim().toLowerCase();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '通知邮箱格式不正确' }, { status: 400 });
    }

    await setSystemSetting(JOIN_REQUEST_NOTIFY_EMAIL_KEY, email);

    return NextResponse.json({
      success: true,
      joinRequestNotifyEmail: email,
    });
  } catch (error) {
    console.error('update system settings error:', error);
    return NextResponse.json({ error: '更新系统设置失败' }, { status: 500 });
  }
}
