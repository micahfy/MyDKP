import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/auth';
import { slugifyTeamName } from '@/lib/teamSlug';

export const dynamic = 'force-dynamic';

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((item) => normalizeText(item)).filter(Boolean)));
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const payload = await request.json();
    const teamIds = uniqueStrings(Array.isArray(payload.teamIds) ? payload.teamIds : []);
    const serverName = normalizeText(payload.serverName);
    const guildName = normalizeText(payload.guildName);
    const slugPrefix = normalizeText(payload.slugPrefix);

    if (teamIds.length === 0) {
      return NextResponse.json({ error: '请先选择要批量修改的团队' }, { status: 400 });
    }

    if (!serverName && !guildName && !slugPrefix) {
      return NextResponse.json({ error: '请至少填写一个批量修改项' }, { status: 400 });
    }

    if (guildName && !serverName) {
      return NextResponse.json({ error: '批量修改工会时必须同时指定服务器' }, { status: 400 });
    }

    const teams = await prisma.team.findMany({
      where: {
        id: { in: teamIds },
      },
      select: {
        id: true,
        name: true,
        serverName: true,
        guildName: true,
        slug: true,
      },
    });

    if (teams.length !== teamIds.length) {
      return NextResponse.json({ error: '存在无效团队，批量修改已取消' }, { status: 400 });
    }

    const targetRows = teams.map((team) => ({
      id: team.id,
      name: team.name,
      serverName: serverName || team.serverName,
      guildName: guildName || team.guildName,
    }));

    const localKeySet = new Set<string>();
    for (const item of targetRows) {
      const key = `${item.serverName}::${item.guildName}::${item.name}`;
      if (localKeySet.has(key)) {
        return NextResponse.json(
          { error: `批量修改后存在重名冲突：${item.serverName}/${item.guildName}/${item.name}` },
          { status: 409 },
        );
      }
      localKeySet.add(key);
    }

    const conflictChecks = targetRows.map((item) => ({
      serverName: item.serverName,
      guildName: item.guildName,
      name: item.name,
    }));

    const conflicts = await prisma.team.findMany({
      where: {
        OR: conflictChecks,
        NOT: {
          id: { in: teamIds },
        },
      },
      select: {
        id: true,
        name: true,
        serverName: true,
        guildName: true,
      },
      take: 1,
    });

    if (conflicts.length > 0) {
      const first = conflicts[0];
      return NextResponse.json(
        { error: `目标位置已存在同名团队：${first.serverName}/${first.guildName}/${first.name}` },
        { status: 409 },
      );
    }

    const slugByTeamId = new Map<string, string | null>();

    if (slugPrefix) {
      const existingSlugRows = await prisma.team.findMany({
        where: {
          slug: { not: null },
          NOT: {
            id: { in: teamIds },
          },
        },
        select: { slug: true },
      });

      const usedSlugs = new Set(existingSlugRows.map((item) => String(item.slug || '').trim()).filter(Boolean));

      for (const team of teams) {
        const base = slugifyTeamName(`${slugPrefix}-${team.name}`);
        let candidate = base;
        let index = 2;
        while (usedSlugs.has(candidate)) {
          candidate = `${base}-${index}`;
          index += 1;
        }
        usedSlugs.add(candidate);
        slugByTeamId.set(team.id, candidate);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const team of teams) {
        await tx.team.update({
          where: { id: team.id },
          data: {
            serverName: serverName || undefined,
            guildName: guildName || undefined,
            slug: slugByTeamId.has(team.id) ? slugByTeamId.get(team.id) : undefined,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: teams.length,
    });
  } catch (error) {
    console.error('PATCH /api/teams/manage/batch error:', error);
    return NextResponse.json({ error: '批量修改失败' }, { status: 500 });
  }
}
