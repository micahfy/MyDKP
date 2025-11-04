import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    const adminStatus = await isAdmin();
    
    if (!adminStatus) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

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
        await prisma.player.create({
          data: {
            name: name.trim(),
            class: className.trim(),
            currentDkp: dkp,
            totalEarned: dkp,
            teamId,
          },
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