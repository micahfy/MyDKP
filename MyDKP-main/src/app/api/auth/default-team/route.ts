import { NextResponse } from 'next/server';
import { getAdminTeams, getSession, isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDefaultLoginTeamId } from '@/lib/systemSettings';
import { resolveTeamSlug } from '@/lib/teamSlug';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const adminTeamIds = await getAdminTeams();
    if (adminTeamIds.length === 0) {
      return NextResponse.json({ teamId: null, teamSlug: null });
    }

    const teams = await prisma.team.findMany({
      where: { id: { in: adminTeamIds } },
      select: {
        id: true,
        slug: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    if (teams.length === 0) {
      return NextResponse.json({ teamId: null, teamSlug: null });
    }

    let target = teams[0];
    const defaultLoginTeamId = await getDefaultLoginTeamId();
    if (defaultLoginTeamId) {
      const matched = teams.find((item) => item.id === defaultLoginTeamId);
      if (matched) {
        target = matched;
      }
    }

    return NextResponse.json({
      teamId: target.id,
      teamSlug: resolveTeamSlug(target),
      role: session.role || null,
    });
  } catch (error) {
    console.error('GET /api/auth/default-team error:', error);
    return NextResponse.json({ error: '获取默认团队失败' }, { status: 500 });
  }
}
