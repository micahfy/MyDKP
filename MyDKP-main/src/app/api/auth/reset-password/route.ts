import { NextRequest, NextResponse } from 'next/server';
import { validatePassword, hashPassword } from '@/lib/password';
import { resetAdminPasswordWithToken } from '@/lib/passwordReset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    const normalizedToken = String(token || '').trim();
    const normalizedPassword = String(newPassword || '');

    if (!normalizedToken || !normalizedPassword) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const validation = validatePassword(normalizedPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: '新密码不符合要求', details: validation.errors },
        { status: 400 },
      );
    }

    const hashedPassword = await hashPassword(normalizedPassword);
    await resetAdminPasswordWithToken(normalizedToken, hashedPassword);

    return NextResponse.json({ success: true, message: '密码重置成功，请重新登录。' });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : '重置密码失败';
    const isInvalidToken = message.includes('无效') || message.includes('过期');
    return NextResponse.json(
      { error: isInvalidToken ? message : '重置密码失败' },
      { status: isInvalidToken ? 400 : 500 },
    );
  }
}
