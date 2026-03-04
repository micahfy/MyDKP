import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAdminLoginCaptchaPolicy } from '@/lib/systemSettings';
import * as bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function getCaptchaVerifyParam(request: NextRequest, payload: Record<string, unknown>) {
  const bodyValue =
    typeof payload.captchaVerifyParam === 'string' ? payload.captchaVerifyParam : '';
  const headerValue =
    request.headers.get('captcha_verify_param') ||
    request.headers.get('captcha-verify-param') ||
    '';
  const queryValue = request.nextUrl.searchParams.get('captcha_verify_param') || '';

  return [bodyValue, headerValue, queryValue]
    .map((item) => item.trim())
    .find((item) => item.length > 0) || '';
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.json();
    const payload =
      rawPayload && typeof rawPayload === 'object'
        ? (rawPayload as Record<string, unknown>)
        : {};
    const username = String(payload.username || '').trim();
    const password = String(payload.password || '');

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const captchaPolicy = await getAdminLoginCaptchaPolicy();
    if (captchaPolicy.required) {
      if (!captchaPolicy.configured) {
        return NextResponse.json(
          { error: '管理员登录验证码配置不完整，请联系超级管理员或开启紧急旁路' },
          { status: 503 },
        );
      }

      const captchaVerifyParam = getCaptchaVerifyParam(request, payload);
      if (!captchaVerifyParam) {
        return NextResponse.json({ error: '请先完成拼图验证码验证' }, { status: 400 });
      }
    }

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const session = await getSession();
    session.isAdmin = true;
    session.adminId = admin.id;
    session.username = admin.username;
    session.role = admin.role as 'super_admin' | 'admin';
    session.needPasswordChange = admin.needPasswordChange;
    session.permissionVersion = admin.permissionVersion;
    await session.save();

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        needPasswordChange: admin.needPasswordChange,
        permissionVersion: admin.permissionVersion,
      },
    });
    response.headers.set('x-admin-login-captcha-required', captchaPolicy.required ? '1' : '0');
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}
