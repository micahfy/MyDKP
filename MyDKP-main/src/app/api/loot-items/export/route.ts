import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const items = await prisma.lootItem.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });

    const content = items.map((item) => item.name).join('\n');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="loot-items.txt"',
      },
    });
  } catch (error) {
    console.error('GET /api/loot-items/export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
