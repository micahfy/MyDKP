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
      select: {
        id: true,
        parsedRows: true,
        editedRows: true,
        status: true,
        teamId: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      teamId: session.teamId,
      parsedRows: JSON.parse(session.parsedRows || '[]'),
      editedRows: session.editedRows ? JSON.parse(session.editedRows) : null,
    });
  } catch (error) {
    console.error('GET webdkp session error:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: '缺少 rows 数据' }, { status: 400 });
    }

    await prisma.webdkpSession.update({
      where: { id: params.id },
      data: {
        editedRows: JSON.stringify(body.rows),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update webdkp session error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}
