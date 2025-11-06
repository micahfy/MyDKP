import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession } from '@/lib/auth';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

    const session = await getSession();
    const { csvData, teamId } = await request.json();

    if (!csvData || !teamId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
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
        // 使用事务确保玩家创建和日志记录同时成功
        await prisma.$transaction(async (tx) => {
          // 创建玩家
          const player = await tx.player.create({
            data: {
              name: name.trim(),
              class: className.trim(),
              currentDkp: dkp,
              totalEarned: dkp,
              teamId,
            },
          });

          // 如果初始DKP大于0，创建一条日志记录
          if (dkp > 0) {
            await tx.dkpLog.create({
              data: {
                playerId: player.id,
                teamId,
                type: 'earn',
                change: dkp,
                reason: `创建玩家，初始DKP ${dkp.toFixed(1)} 分`,
                operator: session.username || 'admin',
              },
            });
          } else if (dkp === 0) {
            // 即使DKP为0也记录创建日志
            await tx.dkpLog.create({
              data: {
                playerId: player.id,
                teamId,
                type: 'earn',
                change: 0,
                reason: '创建玩家',
                operator: session.username || 'admin',
              },
            });
          }
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
      errors: errors.slice(0, 10), // 只返回前10个错误
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}