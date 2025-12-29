import { NextRequest, NextResponse } from 'next/server';
import { ensureGlobalFaultKeywords } from '@/lib/faultKeywords';
import { getSession, hasTeamPermission, isAdmin, isSuperAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId') || '';
    const superAdmin = await isSuperAdmin();

    if (!teamId) {
      if (!superAdmin) {
        return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
      }
      const globalKeywords = await ensureGlobalFaultKeywords();
      return NextResponse.json({ global: globalKeywords, team: [] });
    }

    if (!superAdmin) {
      const permitted = await hasTeamPermission(teamId);
      if (!permitted) {
        return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
      }
    }

    const globalKeywords = await ensureGlobalFaultKeywords();
    const teamKeywords = await prisma.faultKeyword.findMany({
      where: { scope: 'team', teamId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ global: globalKeywords, team: teamKeywords });
  } catch (error) {
    console.error('Get fault keywords error:', error);
    return NextResponse.json({ error: '获取关键字失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const scope = body.scope === 'global' ? 'global' : 'team';
    const teamId = typeof body.teamId === 'string' ? body.teamId.trim() : '';

    if (scope === 'global') {
      if (!(await isSuperAdmin())) {
        return NextResponse.json({ error: '权限不足' }, { status: 403 });
      }
    } else {
      if (!teamId) {
        return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
      }
      const permitted = await hasTeamPermission(teamId);
      if (!permitted) {
        return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
      }
    }

    let names: string[] = [];
    if (name) {
      names = [name];
    } else if (text) {
      names = text
        .split(/[\n,，]+/)
        .map((item: string) => item.trim())
        .filter(Boolean);
    }

    if (names.length === 0) {
      return NextResponse.json({ error: '请输入关键字' }, { status: 400 });
    }

    const uniqueNames = Array.from(new Set(names));
    const whereClause: any = scope === 'global'
      ? { scope: 'global', name: { in: uniqueNames } }
      : {
          OR: [
            { scope: 'global', name: { in: uniqueNames } },
            { scope: 'team', teamId, name: { in: uniqueNames } },
          ],
        };
    const existing = await prisma.faultKeyword.findMany({
      where: whereClause,
      select: { name: true },
    });
    const existingSet = new Set(existing.map((item) => item.name));
    const toCreate = uniqueNames.filter((value) => !existingSet.has(value));
    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const session = await getSession();
    const result = await prisma.faultKeyword.createMany({
      data: toCreate.map((value) => ({
        name: value,
        scope,
        teamId: scope === 'team' ? teamId : null,
        createdByAdminId: session.adminId || null,
      })),
    });

    return NextResponse.json({ created: result.count || 0 });
  } catch (error) {
    console.error('Create fault keyword error:', error);
    return NextResponse.json({ error: '保存关键字失败' }, { status: 500 });
  }
}
