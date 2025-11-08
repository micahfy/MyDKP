import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface SessionData {
  adminId?: string;
  username?: string;
  role?: 'super_admin' | 'admin';
  isAdmin: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'wow-dkp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAdmin(): Promise<boolean> {
  try {
    const session = await getSession();
    return session.isAdmin === true && !!session.adminId;
  } catch (error) {
    console.error('Session check error:', error);
    return false;
  }
}

export async function isSuperAdmin(): Promise<boolean> {
  try {
    const session = await getSession();
    return session.isAdmin === true && session.role === 'super_admin';
  } catch (error) {
    console.error('Super admin check error:', error);
    return false;
  }
}

export async function hasTeamPermission(teamId: string): Promise<boolean> {
  try {
    const session = await getSession();
    
    if (!session.isAdmin || !session.adminId) {
      return false;
    }

    // 超级管理员有所有权限
    if (session.role === 'super_admin') {
      return true;
    }

    // 检查是否有该团队的权限
    const permission = await prisma.teamPermission.findUnique({
      where: {
        adminId_teamId: {
          adminId: session.adminId,
          teamId: teamId,
        },
      },
    });

    return !!permission;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

export async function getAdminTeams(): Promise<string[]> {
  try {
    const session = await getSession();
    
    if (!session.isAdmin || !session.adminId) {
      return [];
    }

    // 超级管理员返回所有团队
    if (session.role === 'super_admin') {
      const teams = await prisma.team.findMany({
        select: { id: true },
      });
      return teams.map(t => t.id);
    }

    // 普通管理员返回有权限的团队
    const permissions = await prisma.teamPermission.findMany({
      where: { adminId: session.adminId },
      select: { teamId: true },
    });

    return permissions.map(p => p.teamId);
  } catch (error) {
    console.error('Get admin teams error:', error);
    return [];
  }
}