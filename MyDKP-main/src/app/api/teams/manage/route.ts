import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizeText(value: string | null) {
  return String(value || '').trim();
}

function parsePositiveInt(value: string | null, defaultValue: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = normalizeText(searchParams.get('q'));
    const serverName = normalizeText(searchParams.get('serverName'));
    const guildName = normalizeText(searchParams.get('guildName'));
    const page = parsePositiveInt(searchParams.get('page'), 1);
    const pageSize = Math.min(parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);

    const where: Prisma.TeamWhereInput = {};

    if (serverName) {
      where.serverName = serverName;
    }
    if (guildName) {
      where.guildName = guildName;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { serverName: { contains: q } },
        { guildName: { contains: q } },
        { slug: { contains: q } },
      ];
    }

    const skip = (page - 1) * pageSize;

    const [total, items, serverGroups, guildGroups] = await Promise.all([
      prisma.team.count({ where }),
      prisma.team.findMany({
        where,
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          serverName: true,
          guildName: true,
          slug: true,
          description: true,
          sortOrder: true,
          updatedAt: true,
          _count: {
            select: {
              players: true,
            },
          },
        },
        orderBy: [
          { name: 'asc' },
          { serverName: 'asc' },
          { guildName: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      prisma.team.groupBy({
        by: ['serverName'],
        _count: { _all: true },
        orderBy: { serverName: 'asc' },
      }),
      prisma.team.groupBy({
        by: ['serverName', 'guildName'],
        _count: { _all: true },
        where: serverName ? { serverName } : undefined,
        orderBy: [{ serverName: 'asc' }, { guildName: 'asc' }],
      }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      serverOptions: serverGroups.map((item) => ({
        serverName: item.serverName,
        count: item._count._all,
      })),
      guildOptions: guildGroups.map((item) => ({
        serverName: item.serverName,
        guildName: item.guildName,
        count: item._count._all,
      })),
    });
  } catch (error) {
    console.error('GET /api/teams/manage error:', error);
    return NextResponse.json({ error: '获取团队管理列表失败' }, { status: 500 });
  }
}
