import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission } from '@/lib/auth';
import { isTalentValidForClass, normalizeTalentName } from '@/lib/talents';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    const search = searchParams.get('search');
    const classFilter = searchParams.get('class');
    const includeArchived = searchParams.get('includeArchived') === '1';

    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (!includeArchived) where.isArchived = false;
    if (search) {
      where.name = { contains: search };
    }
    if (classFilter) where.class = classFilter;

    const players = await prisma.player.findMany({
      where,
      orderBy: { currentDkp: 'desc' },
      include: {
        team: { select: { name: true } },
      },
    });

    const response = NextResponse.json(players);
    
    // 添加缓存头
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    console.error('Get players error:', error);
    return NextResponse.json({ error: '获取玩家失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const {
      name,
      class: playerClass,
      teamId,
      currentDkp = 0,
      totalEarned = 0,
      totalSpent = 0,
      attendance = 0,
      talent,
    } = data;

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({ error: '缺少团队ID' }, { status: 400 });
    }

    if (!name || !playerClass) {
      return NextResponse.json({ error: '玩家名称和职业不能为空' }, { status: 400 });
    }

    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const trimmedName = name.trim();
    const trimmedClass = playerClass.trim();
    const normalizedTalent = normalizeTalentName(talent);

    if (normalizedTalent && !isTalentValidForClass(trimmedClass, normalizedTalent)) {
      return NextResponse.json({ error: '天赋与职业不匹配' }, { status: 400 });
    }

    const player = await prisma.player.create({
      data: {
        name: trimmedName,
        class: trimmedClass,
        talent: normalizedTalent,
        teamId,
        currentDkp,
        totalEarned,
        totalSpent,
        attendance,
      },
    });
    return NextResponse.json(player);
  } catch (error) {
    console.error('Create player error:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: '该团队中已存在同名玩家' }, { status: 409 });
    }

    return NextResponse.json({ error: '创建玩家失败' }, { status: 500 });
  }
}
