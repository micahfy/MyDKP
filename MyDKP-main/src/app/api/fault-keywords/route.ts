import { NextRequest, NextResponse } from 'next/server';
import { ensureFaultKeywords } from '@/lib/faultKeywords';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const keywords = await ensureFaultKeywords();
    return NextResponse.json(keywords);
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
    const existing = await prisma.faultKeyword.findMany({
      where: { name: { in: uniqueNames } },
      select: { name: true },
    });
    const existingSet = new Set(existing.map((item) => item.name));
    const toCreate = uniqueNames.filter((value) => !existingSet.has(value));
    if (toCreate.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const result = await prisma.faultKeyword.createMany({
      data: toCreate.map((value) => ({ name: value })),
    });

    return NextResponse.json({ created: result.count || 0 });
  } catch (error) {
    console.error('Create fault keyword error:', error);
    return NextResponse.json({ error: '保存关键字失败' }, { status: 500 });
  }
}
