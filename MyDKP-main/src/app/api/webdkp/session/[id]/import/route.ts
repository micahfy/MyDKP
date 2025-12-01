import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildImportPayload, buildUpdatedLua, buildWebdkpTable, WebdkpLogRow } from '@/lib/webdkp';
import { runBatchImport } from '@/lib/dkpBatchImport';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const teamId = String(body.teamId || '').trim();
    if (!teamId) {
      return NextResponse.json({ error: '请选择要导入的团队' }, { status: 400 });
    }

    if (!(await hasTeamPermission(teamId))) {
      return NextResponse.json({ error: '您没有权限操作该团队' }, { status: 403 });
    }

    const sessionRecord = await prisma.webdkpSession.findUnique({
      where: { id: params.id },
    });

    if (!sessionRecord) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const parsedRows = sessionRecord.parsedRows ? JSON.parse(sessionRecord.parsedRows) : [];
    const editedRows = sessionRecord.editedRows ? JSON.parse(sessionRecord.editedRows) : null;
    const rows: WebdkpLogRow[] = (editedRows && editedRows.length ? editedRows : parsedRows) || [];
    if (rows.length === 0) {
      return NextResponse.json({ error: '没有可导入的数据' }, { status: 400 });
    }

    const session = await getSession();

    const playerNames = Array.from(
      new Set(rows.map((row) => (row.player || '').trim()).filter((name) => !!name)),
    );

    if (playerNames.length > 0) {
      const existingPlayers = await prisma.player.findMany({
        where: {
          teamId,
          name: { in: playerNames },
        },
        select: { name: true },
      });

      const existingNames = new Set(existingPlayers.map((player) => player.name));
      const rowsByPlayer = new Map<string, WebdkpLogRow>();
      rows.forEach((row) => {
        if (row.player && !rowsByPlayer.has(row.player)) {
          rowsByPlayer.set(row.player, row);
        }
      });

      const toCreate = playerNames
        .filter((name) => !existingNames.has(name))
        .map((name) => {
          const source = rowsByPlayer.get(name);
          return {
            name,
            class: source?.className || 'Unknown',
            teamId,
          };
        });

      if (toCreate.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const item of toCreate) {
            const newPlayer = await tx.player.create({
              data: {
                name: item.name,
                class: item.class,
                teamId: item.teamId,
                currentDkp: 0,
                totalEarned: 0,
                totalSpent: 0,
                totalDecay: 0,
                attendance: 0,
              },
            });

            const event = await tx.dkpEvent.create({
              data: {
                teamId: item.teamId,
                type: 'earn',
                change: 0,
                reason: '创建玩家，初始DKP 0分',
                operator: session.username || 'system',
                eventTime: new Date(),
              },
            });

            await tx.dkpLog.create({
              data: {
                playerId: newPlayer.id,
                teamId: item.teamId,
                type: 'earn',
                change: 0,
                reason: '创建玩家，初始DKP 0分',
                operator: session.username || 'system',
                eventId: event.id,
                createdAt: event.eventTime,
              },
            });
          }
        });
      }
    }

    const importData = buildImportPayload(rows);
    const result = await runBatchImport({
      teamId,
      importData,
      operator: session.username || 'admin',
      ignoreDuplicates: body.ignoreDuplicates !== false,
    });

    const tableText = await buildWebdkpTable(session);
    const updatedLua = buildUpdatedLua(sessionRecord.originalLua, tableText);

    await prisma.webdkpSession.update({
      where: { id: params.id },
      data: {
        finalLua: updatedLua,
        teamId,
        status: 'completed',
      },
    });

    return NextResponse.json({
      result,
      downloadAvailable: true,
    });
  } catch (error) {
    console.error('WebDKP import error:', error);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
