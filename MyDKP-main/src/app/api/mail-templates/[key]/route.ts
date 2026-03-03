import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/auth';
import {
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
  resetEmailTemplateToDefault,
  updateEmailTemplateByKey,
} from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

function parseTemplateKey(raw: string): EmailTemplateKey | null {
  if ((EMAIL_TEMPLATE_KEYS as readonly string[]).includes(raw)) {
    return raw as EmailTemplateKey;
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const key = parseTemplateKey(params.key);
    if (!key) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const { subject, bodyText } = await request.json();
    const updated = await updateEmailTemplateByKey(key, {
      subject: String(subject || ''),
      bodyText: String(bodyText || ''),
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : '更新模板失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { key: string } },
) {
  try {
    if (!(await isSuperAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const key = parseTemplateKey(params.key);
    if (!key) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const reset = await resetEmailTemplateToDefault(key);
    return NextResponse.json({ success: true, template: reset });
  } catch (error) {
    console.error('reset template error:', error);
    return NextResponse.json({ error: '重置模板失败' }, { status: 500 });
  }
}
