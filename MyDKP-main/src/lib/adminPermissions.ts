import { prisma } from '@/lib/prisma';

export type AdminPermissionPayload = {
  rootAccess: boolean;
  serverAccesses: string[];
  guildAccesses: Array<{ serverName: string; guildName: string }>;
  teamIds: string[];
};

function normalizeText(input: unknown) {
  return String(input || '').trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean)));
}

export async function getAdminPermissionTree(adminId: string) {
  const [admin, teams, teamPermissions, scopes] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        serverName: true,
        guildName: true,
        slug: true,
      },
      orderBy: [{ serverName: 'asc' }, { guildName: 'asc' }, { name: 'asc' }],
    }),
    prisma.teamPermission.findMany({
      where: { adminId },
      select: { teamId: true },
    }),
    prisma.adminPermissionScope.findMany({
      where: { adminId },
      select: {
        scopeType: true,
        serverName: true,
        guildName: true,
      },
    }),
  ]);

  if (!admin) {
    throw new Error('管理员不存在');
  }

  const rootAccess = scopes.some((item) => item.scopeType === 'all');
  const serverAccesses = uniqueStrings(
    scopes
      .filter((item) => item.scopeType === 'server')
      .map((item) => item.serverName || ''),
  );
  const guildAccesses = scopes
    .filter((item) => item.scopeType === 'guild' && item.serverName && item.guildName)
    .map((item) => ({
      serverName: item.serverName as string,
      guildName: item.guildName as string,
    }));
  const teamIds = uniqueStrings(teamPermissions.map((item) => item.teamId));

  const serverMap = new Map<
    string,
    {
      serverName: string;
      guilds: Map<
        string,
        {
          guildName: string;
          teams: Array<{ id: string; name: string; slug: string | null }>;
        }
      >;
    }
  >();

  for (const team of teams) {
    if (!serverMap.has(team.serverName)) {
      serverMap.set(team.serverName, {
        serverName: team.serverName,
        guilds: new Map(),
      });
    }

    const server = serverMap.get(team.serverName)!;
    if (!server.guilds.has(team.guildName)) {
      server.guilds.set(team.guildName, {
        guildName: team.guildName,
        teams: [],
      });
    }

    server.guilds.get(team.guildName)!.teams.push({
      id: team.id,
      name: team.name,
      slug: team.slug,
    });
  }

  const catalog = Array.from(serverMap.values()).map((server) => ({
    serverName: server.serverName,
    guilds: Array.from(server.guilds.values()).map((guild) => ({
      guildName: guild.guildName,
      teams: guild.teams,
    })),
  }));

  return {
    admin,
    selections: {
      rootAccess,
      serverAccesses,
      guildAccesses,
      teamIds,
    },
    catalog,
  };
}

export async function saveAdminPermissions(adminId: string, payload: AdminPermissionPayload) {
  const rootAccess = payload.rootAccess === true;
  const serverAccesses = uniqueStrings(payload.serverAccesses || []);
  const guildAccesses = (payload.guildAccesses || [])
    .map((item) => ({
      serverName: normalizeText(item.serverName),
      guildName: normalizeText(item.guildName),
    }))
    .filter((item) => item.serverName && item.guildName)
    .filter((item, index, arr) => arr.findIndex((x) => x.serverName === item.serverName && x.guildName === item.guildName) === index);

  const teamIds = uniqueStrings(payload.teamIds || []);

  const [targetAdmin, existingTeams] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, role: true },
    }),
    prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true },
    }),
  ]);

  if (!targetAdmin) {
    throw new Error('管理员不存在');
  }

  const validTeamIdSet = new Set(existingTeams.map((item) => item.id));
  const filteredTeamIds = teamIds.filter((id) => validTeamIdSet.has(id));

  await prisma.$transaction(async (tx) => {
    await tx.teamPermission.deleteMany({ where: { adminId } });
    await tx.adminPermissionScope.deleteMany({ where: { adminId } });

    if (filteredTeamIds.length > 0) {
      await tx.teamPermission.createMany({
        data: filteredTeamIds.map((teamId) => ({
          adminId,
          teamId,
        })),
      });
    }

    const scopeCreates: Array<{ adminId: string; scopeType: string; serverName?: string | null; guildName?: string | null }> = [];

    if (rootAccess) {
      scopeCreates.push({
        adminId,
        scopeType: 'all',
        serverName: null,
        guildName: null,
      });
    }

    for (const serverName of serverAccesses) {
      scopeCreates.push({
        adminId,
        scopeType: 'server',
        serverName,
        guildName: null,
      });
    }

    for (const guild of guildAccesses) {
      scopeCreates.push({
        adminId,
        scopeType: 'guild',
        serverName: guild.serverName,
        guildName: guild.guildName,
      });
    }

    if (scopeCreates.length > 0) {
      await tx.adminPermissionScope.createMany({ data: scopeCreates });
    }

    await tx.admin.update({
      where: { id: adminId },
      data: {
        permissionVersion: { increment: 1 },
      },
    });
  });

  return {
    rootAccess,
    serverAccesses,
    guildAccesses,
    teamIds: filteredTeamIds,
  };
}
