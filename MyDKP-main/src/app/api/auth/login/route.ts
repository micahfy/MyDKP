import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    ) {
      const session = await getSession();
      session.isAdmin = true;
      session.username = username;
      await session.save();

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: '用户名或密码错误' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}