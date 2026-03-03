import { NextRequest, NextResponse } from 'next/server';
import { sendJoinRequestVerificationCode } from '@/lib/joinRequests';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const result = await sendJoinRequestVerificationCode(String(email || ''));

    if (result.throttled) {
      return NextResponse.json(
        {
          success: true,
          throttled: true,
          retryAfterSeconds: result.retryAfterSeconds || 0,
          message: '发送过于频繁，请稍后再试。',
        },
        { status: 200 },
      );
    }

    return NextResponse.json({ success: true, message: '验证码已发送，请查收邮箱。' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '发送验证码失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
