import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { csvData, teamId } = await request.json();

    if (!csvData || !teamId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const hasPermission = await hasTeamPermission(teamId);
    if (!hasPermission) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const parsed = Papa.parse(csvData, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (row.length < 2) {
        errorCount++;
        continue;
      }

      const [name, className, initialDkp] = row;
      const dkp = parseFloat(initialDkp) || 0;

      if (!name || !className) {
        errorCount++;
        errors.push(`跳过无效行: ${row.join(',')}`);
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const player = await tx.player.create({
            data: {
              name: name.trim(),
              class: className.trim(),
              currentDkp: dkp,
              totalEarned: dkp,
              teamId,
            },
          });

          const event = await tx.dkpEvent.create({
            data: {
              teamId,
              type: 'earn',
              change: dkp,
              reason: dkp > 0 ? `创建玩家，初始DKP ${dkp.toFixed(1)} 分` : '创建玩家',
              operator: session.username || 'admin',
              eventTime: new Date(),
            },
          });

          await tx.dkpLog.create({
            data: {
              playerId: player.id,
              teamId,
              type: 'earn',
              change: null,
              reason: null,
              operator: session.username || 'admin',
              eventId: event.id,
              createdAt: event.eventTime,
            },
          });
        });

        successCount++;
      } catch (error: any) {
        errorCount++;
        if (error.code === 'P2002') {
          errors.push(`玩家 ${name} 已存在`);
        } else {
          errors.push(`导入 ${name} 失败: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: errorCount,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
