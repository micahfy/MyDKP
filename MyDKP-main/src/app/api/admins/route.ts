import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin, getSession } from '@/lib/auth';
import { hashPassword, validatePassword } from '@/lib/password';

// GET /api/admins - 获取管理员列表（仅超管）
export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        teamPermissions: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    return NextResponse.json({ error: '获取管理员列表失败' }, { status: 500 });
  }
}

// POST /api/admins - 创建管理员（仅超管）
export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { username, password, role, teamIds } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: '密码不符合要求', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existing = await prisma.admin.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 409 });
    }

    // 创建管理员
    const hashedPassword = await hashPassword(password);
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: role || 'admin',
        needPasswordChange: false,
      },
    });

    // 分配团队权限
    if (teamIds && teamIds.length > 0) {
      await prisma.teamPermission.createMany({
        data: teamIds.map((teamId: string) => ({
          adminId: admin.id,
          teamId,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: '创建管理员失败' }, { status: 500 });
  }
}