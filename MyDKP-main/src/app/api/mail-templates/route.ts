import { NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import { listEmailTemplates } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const templates = await listEmailTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('list mail templates error:', error);
    return NextResponse.json({ error: '获取邮件模板失败' }, { status: 500 });
  }
}
