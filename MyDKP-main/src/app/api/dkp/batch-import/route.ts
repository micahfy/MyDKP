import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';
import { runBatchImport } from '@/lib/dkpBatchImport';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { teamId, importData, ignoreDuplicates = true, createMissingPlayers = false } = await request.json();

    if (!teamId || !importData) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const result = await runBatchImport({
      teamId,
      importData,
      ignoreDuplicates,
      createMissingPlayers,
      operator: session.username || 'admin',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: '批量导入失败' }, { status: 500 });
  }
}
