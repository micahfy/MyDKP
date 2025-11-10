import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 标记为动态路由
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    
    // 如果没有登录，返回未授权状态
    if (!session.isAdmin || !session.adminId) {
      return NextResponse.json({ 
        isAdmin: false, 
        username: null, 
        role: null,
        needPasswordChange: false,
        permissionChanged: false,
      });
    }

    // 从数据库获取最新的管理员信息
    const admin = await prisma.admin.findUnique({
      where: { id: session.adminId },
      select: {
        username: true,
        role: true,
        isActive: true,
        needPasswordChange: true,
        permissionVersion: true,
      },
    });

    // 管理员不存在或已被禁用
    if (!admin || !admin.isActive) {
      // 清除 session
      session.destroy();
      return NextResponse.json({ 
        isAdmin: false, 
        username: null, 
        role: null,
        needPasswordChange: false,
        permissionChanged: true,
        forceLogout: true,
        reason: admin ? '账号已被禁用' : '账号已被删除',
      });
    }

    // 检查权限版本号是否变化
    const permissionChanged = session.permissionVersion !== admin.permissionVersion;

    if (permissionChanged) {
      // 权限已变更，更新 session
      session.role = admin.role as 'super_admin' | 'admin';
      session.permissionVersion = admin.permissionVersion;
      await session.save();
    }

    return NextResponse.json({ 
      isAdmin: true,
      username: admin.username,
      role: admin.role,
      needPasswordChange: admin.needPasswordChange,
      permissionChanged,
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ 
      isAdmin: false, 
      username: null, 
      role: null,
      needPasswordChange: false,
      permissionChanged: false,
    });
  }
}