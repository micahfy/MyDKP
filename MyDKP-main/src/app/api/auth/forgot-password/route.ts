import { NextRequest, NextResponse } from 'next/server';
import { requestAdminPasswordReset } from '@/lib/passwordReset';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();
    const normalizedIdentifier = String(identifier || '').trim();

    if (!normalizedIdentifier) {
      return NextResponse.json({ error: '请输入用户名或邮箱' }, { status: 400 });
    }

    try {
      await requestAdminPasswordReset(normalizedIdentifier);
    } catch (error) {
      // Do not leak account existence or internals to clients.
      console.error('forgot-password send error:', error);
    }

    return NextResponse.json({
      success: true,
      message: '如果账号存在且已绑定邮箱，我们已发送重置邮件。',
    });
  } catch (error) {
    console.error('forgot-password error:', error);
    return NextResponse.json({
      success: true,
      message: '如果账号存在且已绑定邮箱，我们已发送重置邮件。',
    });
  }
}
