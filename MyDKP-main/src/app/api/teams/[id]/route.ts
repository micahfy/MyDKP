import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/auth';
import { generateUniqueTeamSlug } from '@/lib/teamSlug';

export const dynamic = 'force-dynamic';

function normalizeText(input: unknown) {
  return String(input || '').trim();
}

function normalizeSlug(input: unknown) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(raw)) {
    throw new Error('短链接只允许 A-Z、a-z、0-9、_、-，长度 1-48');
  }
  return raw;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
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
          select: {
            players: true,
            dkpLogs: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 });
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ error: '获取团队失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足，只有超级管理员可以修改团队' }, { status: 403 });
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

    const existingTeam = await prisma.team.findUnique({
      where: { id: params.id },
    });

    if (!existingTeam) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 });
    }

    if (
      name !== existingTeam.name ||
      serverName !== existingTeam.serverName ||
      guildName !== existingTeam.guildName
    ) {
      const duplicate = await prisma.team.findUnique({
        where: {
          serverName_guildName_name: {
            serverName,
            guildName,
            name,
          },
        },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== params.id) {
        return NextResponse.json({ error: '该服务器和工会下已存在同名团队' }, { status: 409 });
      }
    }

    let slug = '';
    try {
      slug = normalizeSlug(payload.slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : '短链接格式不正确';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (slug) {
      const duplicateSlug = await prisma.team.findFirst({
        where: {
          slug,
          NOT: { id: params.id },
        },
        select: { id: true },
      });
      if (duplicateSlug) {
        return NextResponse.json({ error: '短链接已被占用' }, { status: 409 });
      }
    } else {
      slug = await generateUniqueTeamSlug(name, params.id);
    }

    const team = await prisma.team.update({
      where: { id: params.id },
      data: {
        name,
        serverName,
        guildName,
        slug,
        description,
      },
    });

    return NextResponse.json(team);
  } catch (error: any) {
    console.error('Update team error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '团队信息冲突，请检查后重试' }, { status: 409 });
    }
    return NextResponse.json({ error: '更新团队失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足，只有超级管理员可以删除团队' }, { status: 403 });
    }

    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { players: true },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: '团队不存在' }, { status: 404 });
    }

    await prisma.team.delete({ where: { id: params.id } });

    return NextResponse.json({
      success: true,
      message: `已删除团队 ${team.name}，包含 ${team._count.players} 名玩家的数据`,
    });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: '删除团队失败' }, { status: 500 });
  }
}
