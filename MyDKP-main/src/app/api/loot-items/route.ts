import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';
import { normalizeLootName } from '@/lib/loot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const items = await prisma.lootItem.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/loot-items error:', error);
    return NextResponse.json({ error: '获取装备库失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const payload = await request.json();
    const names: string[] = [];

    if (Array.isArray(payload?.names)) {
      names.push(...payload.names);
    }
    if (typeof payload?.name === 'string') {
      names.push(payload.name);
    }
    if (typeof payload?.text === 'string') {
      names.push(...payload.text.split(/\r?\n/));
    }

    const normalizedEntries = names
      .map((value: string) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => ({
        raw: value,
        normalized: normalizeLootName(value),
      }));

    if (normalizedEntries.length === 0) {
      return NextResponse.json({ error: '没有可导入的名称' }, { status: 400 });
    }

    const uniqueMap = new Map<string, string>();
    for (const entry of normalizedEntries) {
      if (!uniqueMap.has(entry.normalized)) {
        uniqueMap.set(entry.normalized, entry.raw);
      }
    }

    const normalizedList = Array.from(uniqueMap.keys());

    const existing = await prisma.lootItem.findMany({
      where: { searchName: { in: normalizedList } },
      select: { searchName: true },
    });
    const existingSet = new Set(existing.map((item) => item.searchName));

    const toCreate = normalizedList
      .filter((normalized) => !existingSet.has(normalized))
      .map((normalized) => ({
        name: uniqueMap.get(normalized) || normalized,
        searchName: normalized,
      }));

    if (toCreate.length > 0) {
      await prisma.lootItem.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      created: toCreate.length,
      skipped: normalizedList.length - toCreate.length,
    });
  } catch (error: any) {
    console.error('POST /api/loot-items error:', error);
    return NextResponse.json({ error: '保存装备失败' }, { status: 500 });
  }
}
