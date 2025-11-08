import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    // 查找数据库中的管理员
    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 检查账号是否激活
    if (!admin.isActive) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 });
    }

    // 验证密码
    const isValidPassword = await verifyPassword(password, admin.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 更新最后登录时间
    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    // 设置 session
    const session = await getSession();
    session.isAdmin = true;
    session.adminId = admin.id;
    session.username = admin.username;
    session.role = admin.role as 'super_admin' | 'admin';
    session.needPasswordChange = admin.needPasswordChange;
    await session.save();

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        needPasswordChange: admin.needPasswordChange,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '登录失败' }, { status: 500 });
  }
}