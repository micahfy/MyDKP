import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission } from '@/lib/auth';
import { isTalentValidForClass, mapTalentCodeToName, normalizeTalentName } from '@/lib/talents';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足，请先登录管理员账号' }, { status: 403 });
    }

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
      if (row.length < 1) {
        errorCount++;
        continue;
      }

      const [nameRaw, talentRaw] = row;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      const talentCode = typeof talentRaw === 'string' ? talentRaw.trim() : '';

      if (!name) {
        errorCount++;
        errors.push(`跳过无效行: ${row.join(',')}`);
        continue;
      }

      const player = await prisma.player.findFirst({
        where: {
          teamId,
          name,
        },
      });

      if (!player) {
        errorCount++;
        errors.push(`未找到玩家: ${name}`);
        continue;
      }

      const mappedTalent = mapTalentCodeToName(player.class, talentCode);
      const normalizedTalent = normalizeTalentName(mappedTalent);

      if (talentCode && !normalizedTalent) {
        errorCount++;
        errors.push(`未知天赋编号: ${name} -> ${talentCode}`);
        continue;
      }

      if (normalizedTalent && !isTalentValidForClass(player.class, normalizedTalent)) {
        errorCount++;
        errors.push(`天赋与职业不匹配: ${name} (${player.class}) -> ${normalizedTalent}`);
        continue;
      }

      await prisma.player.update({
        where: { id: player.id },
        data: { talent: normalizedTalent ?? null },
      });

      successCount++;
    }

    return NextResponse.json({
      success: true,
      updated: successCount,
      failed: errorCount,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Import talent error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
