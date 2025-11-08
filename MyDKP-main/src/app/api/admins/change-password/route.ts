import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/password';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证新密码强度
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: '新密码不符合要求', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // 获取当前管理员信息
    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
    });

    if (!admin) {
      return NextResponse.json({ error: '管理员不存在' }, { status: 404 });
    }

    // 验证旧密码
    const isValidOldPassword = await verifyPassword(oldPassword, admin.password);
    if (!isValidOldPassword) {
      return NextResponse.json({ error: '原密码错误' }, { status: 401 });
    }

    // 更新密码
    const hashedNewPassword = await hashPassword(newPassword);
    await prisma.admin.update({
      where: { id: session.adminId },
      data: { 
        password: hashedNewPassword,
        needPasswordChange: false,
      },
    });

    // 更新session
    session.needPasswordChange = false;
    await session.save();

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 });
  }
}