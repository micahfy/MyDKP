import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export interface SessionData {
  adminId?: string;
  username?: string;
  role?: 'super_admin' | 'admin';
  isAdmin: boolean;
  needPasswordChange?: boolean;
  permissionVersion?: number;
}

type AdminScope = {
  all: boolean;
  servers: Set<string>;
  guilds: Set<string>; // `${serverName}::${guildName}`
};

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'wow-dkp-session',
  cookieOptions: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
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

function toGuildKey(serverName: string, guildName: string) {
  return `${serverName}::${guildName}`;
}

async function getAdminScope(adminId: string): Promise<AdminScope> {
  const scopeRecords = await prisma.adminPermissionScope.findMany({
    where: { adminId },
    select: {
      scopeType: true,
      serverName: true,
      guildName: true,
    },
  });

  const scope: AdminScope = {
    all: false,
    servers: new Set<string>(),
    guilds: new Set<string>(),
  };

  for (const item of scopeRecords) {
    if (item.scopeType === 'all') {
      scope.all = true;
      continue;
    }
    if (item.scopeType === 'server' && item.serverName) {
      scope.servers.add(item.serverName);
      continue;
    }
    if (item.scopeType === 'guild' && item.serverName && item.guildName) {
      scope.guilds.add(toGuildKey(item.serverName, item.guildName));
    }
  }

  return scope;
}

export async function hasTeamPermission(teamId: string): Promise<boolean> {
  try {
    const session = await getSession();

    if (!session.isAdmin || !session.adminId) {
      return false;
    }

    if (session.role === 'super_admin') {
      return true;
    }

    const [team, directPermission, scope] = await Promise.all([
      prisma.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          serverName: true,
          guildName: true,
        },
      }),
      prisma.teamPermission.findUnique({
        where: {
          adminId_teamId: {
            adminId: session.adminId,
            teamId,
          },
        },
        select: { id: true },
      }),
      getAdminScope(session.adminId),
    ]);

    if (!team) return false;
    if (directPermission) return true;
    if (scope.all) return true;
    if (scope.servers.has(team.serverName)) return true;
    if (scope.guilds.has(toGuildKey(team.serverName, team.guildName))) return true;

    return false;
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

    if (session.role === 'super_admin') {
      const teams = await prisma.team.findMany({ select: { id: true } });
      return teams.map((team) => team.id);
    }

    const [directPermissions, scope] = await Promise.all([
      prisma.teamPermission.findMany({
        where: { adminId: session.adminId },
        select: { teamId: true },
      }),
      getAdminScope(session.adminId),
    ]);

    if (scope.all) {
      const teams = await prisma.team.findMany({ select: { id: true } });
      return teams.map((team) => team.id);
    }

    const directTeamIds = directPermissions.map((item) => item.teamId);

    const scopeMatchedTeams = await prisma.team.findMany({
      where: {
        OR: [
          ...(scope.servers.size > 0
            ? [
                {
                  serverName: {
                    in: Array.from(scope.servers),
                  },
                },
              ]
            : []),
          ...(scope.guilds.size > 0
            ? Array.from(scope.guilds).map((item) => {
                const [serverName, guildName] = item.split('::');
                return {
                  serverName,
                  guildName,
                };
              })
            : []),
          ...(directTeamIds.length > 0
            ? [
                {
                  id: { in: directTeamIds },
                },
              ]
            : []),
        ],
      },
      select: { id: true },
    });

    return Array.from(new Set(scopeMatchedTeams.map((team) => team.id)));
  } catch (error) {
    console.error('Get admin teams error:', error);
    return [];
  }
}
