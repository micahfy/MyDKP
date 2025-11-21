import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await prisma.webdkpSession.findUnique({
      where: { id: params.id },
      select: { finalLua: true, originalLua: true, status: true },
    });

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    if (!session.finalLua) {
      return NextResponse.json({ error: '尚未生成最新的 WebDKP 文件' }, { status: 400 });
    }

    return new NextResponse(session.finalLua, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="WebDKP.lua"',
      },
    });
  } catch (error) {
    console.error('WebDKP session download error:', error);
    return NextResponse.json({ error: '下载失败' }, { status: 500 });
  }
}
