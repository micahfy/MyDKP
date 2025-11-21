import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseWebdkpLogs } from '@/lib/webdkp';

export const dynamic = 'force-dynamic';

async function extractLuaContent(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (file instanceof File) {
      return await file.text();
    }
    if (typeof file === 'string') {
      return file;
    }
  }

  const body = await request.json().catch(() => null);
  if (body?.lua) {
    return String(body.lua);
  }
  throw new Error('未找到上传的 WebDKP.lua 内容');
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const luaContent = await extractLuaContent(request);
    const rows = parseWebdkpLogs(luaContent);

    const rowsJson = JSON.stringify(rows);
    const session = await prisma.webdkpSession.create({
      data: {
        originalLua: luaContent,
        parsedRows: rowsJson,
        editedRows: rowsJson,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      rowCount: rows.length,
      rows,
    });
  } catch (error: any) {
    console.error('WebDKP upload error:', error);
    return NextResponse.json({ error: error?.message || '上传失败' }, { status: 400 });
  }
}
