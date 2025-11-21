import { NextResponse } from 'next/server';
import { isAdmin, getSession } from '@/lib/auth';
import { buildWebdkpTable } from '@/lib/webdkp';

export const dynamic = 'force-dynamic';

const LUA_TEMPLATE_PREFIX = `WebDKP_Options = {
\t["SelectedTableId"] = 1,
\t["AutofillEnabled"] = 1,
\t["AutofillThreshold"] = 3,
\t["AutoAwardEnabled"] = 1,
}
WebDKP_Log = {
}
`;

const LUA_TEMPLATE_SUFFIX = `
WebDKP_Tables = {
}
WebDKP_Loot = nil
WebDKP_WebOptions = {
}
`;

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const tableText = await buildWebdkpTable(session);
    const output = `${LUA_TEMPLATE_PREFIX}${tableText}\n${LUA_TEMPLATE_SUFFIX}`;

    return new NextResponse(output, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="WebDKP.lua"',
      },
    });
  } catch (error) {
    console.error('WebDKP export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
