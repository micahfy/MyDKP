import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_LOGIN_TEAM_ID_KEY,
  getDefaultLoginTeamId,
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

    const [joinRequestNotifyEmail, defaultLoginTeamId] = await Promise.all([
      getJoinRequestNotifyEmail(),
      getDefaultLoginTeamId(),
    ]);

    return NextResponse.json({
      joinRequestNotifyEmail,
      defaultLoginTeamId,
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

    const payload = await request.json();
    const hasJoinRequestNotifyEmail = Object.prototype.hasOwnProperty.call(payload, 'joinRequestNotifyEmail');
    const hasDefaultLoginTeamId = Object.prototype.hasOwnProperty.call(payload, 'defaultLoginTeamId');

    if (!hasJoinRequestNotifyEmail && !hasDefaultLoginTeamId) {
      return NextResponse.json({ error: '缺少可更新字段' }, { status: 400 });
    }

    const email = hasJoinRequestNotifyEmail
      ? String(payload.joinRequestNotifyEmail || '').trim().toLowerCase()
      : await getJoinRequestNotifyEmail();
    const defaultLoginTeamId = hasDefaultLoginTeamId
      ? String(payload.defaultLoginTeamId || '').trim()
      : await getDefaultLoginTeamId();

    if (hasJoinRequestNotifyEmail && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '通知邮箱格式不正确' }, { status: 400 });
    }

    if (hasDefaultLoginTeamId && defaultLoginTeamId) {
      const team = await prisma.team.findUnique({
        where: { id: defaultLoginTeamId },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: '默认团队不存在' }, { status: 400 });
      }
    }

    const writes: Promise<unknown>[] = [];
    if (hasJoinRequestNotifyEmail) {
      writes.push(setSystemSetting(JOIN_REQUEST_NOTIFY_EMAIL_KEY, email));
    }
    if (hasDefaultLoginTeamId) {
      writes.push(setSystemSetting(DEFAULT_LOGIN_TEAM_ID_KEY, defaultLoginTeamId));
    }
    if (writes.length > 0) {
      await Promise.all(writes);
    }

    return NextResponse.json({
      success: true,
      joinRequestNotifyEmail: email,
      defaultLoginTeamId,
    });
  } catch (error) {
    console.error('update system settings error:', error);
    return NextResponse.json({ error: '更新系统设置失败' }, { status: 500 });
  }
}
