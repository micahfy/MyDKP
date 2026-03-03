import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminTeams, isAdmin, isSuperAdmin } from '@/lib/auth';
import { generateUniqueTeamSlug } from '@/lib/teamSlug';

export const dynamic = 'force-dynamic';

function normalizeText(input: unknown) {
  return String(input || '').trim();
}

function normalizeSlug(input: unknown) {
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return '';
  if (!/^[a-z0-9_-]{1,48}$/.test(raw)) {
    throw new Error('短链接只允许 a-z、0-9、_、-，长度 1-48');
  }
  return raw;
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const adminTeamIds = await getAdminTeams();

    const teams = await prisma.team.findMany({
      where: {
        id: {
          in: adminTeamIds,
        },
      },
      select: {
        id: true,
        name: true,
        serverName: true,
        guildName: true,
        slug: true,
        description: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { players: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error('GET /api/teams error:', error);
    return NextResponse.json(
      { error: '获取团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足，只有超级管理员可以创建团队' }, { status: 403 });
    }

    const payload = await request.json();
    const name = normalizeText(payload.name);
    const serverName = normalizeText(payload.serverName);
    const guildName = normalizeText(payload.guildName);
    const description = normalizeText(payload.description) || null;

    if (!name) {
      return NextResponse.json({ error: '团队名称不能为空' }, { status: 400 });
    }
    if (!serverName) {
      return NextResponse.json({ error: '服务器不能为空' }, { status: 400 });
    }
    if (!guildName) {
      return NextResponse.json({ error: '工会不能为空' }, { status: 400 });
    }

    const duplicateTeam = await prisma.team.findUnique({
      where: {
        serverName_guildName_name: {
          serverName,
          guildName,
          name,
        },
      },
      select: { id: true },
    });

    if (duplicateTeam) {
      return NextResponse.json({ error: '该服务器和工会下已存在同名团队' }, { status: 409 });
    }

    let slug = '';
    try {
      slug = normalizeSlug(payload.slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : '短链接格式不正确';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (slug) {
      const duplicateSlug = await prisma.team.findFirst({ where: { slug }, select: { id: true } });
      if (duplicateSlug) {
        return NextResponse.json({ error: '短链接已被占用' }, { status: 409 });
      }
    } else {
      slug = await generateUniqueTeamSlug(name);
    }

    const maxSortOrder = await prisma.team.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const team = await prisma.team.create({
      data: {
        name,
        serverName,
        guildName,
        slug,
        description,
        sortOrder: (maxSortOrder?.sortOrder ?? -1) + 1,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error('POST /api/teams error:', error);
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '团队信息冲突，请检查后重试' }, { status: 409 });
    }
    return NextResponse.json(
      { error: '创建团队失败', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
