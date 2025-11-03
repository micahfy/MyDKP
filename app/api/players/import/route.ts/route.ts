import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/auth';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  try {
    const { csvData, teamId } = await request.json();

    const parsed = Papa.parse(csvData, { header: false, skipEmptyLines: true });
    const rows = parsed.data as string[][];

    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      if (row.length < 2) continue;

      const [name, className, initialDkp] = row;
      const dkp = parseFloat(initialDkp) || 0;

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
      } catch (error) {
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: errorCount,
    });
  } catch (error) {
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}