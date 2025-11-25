import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, hasTeamPermission, getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const session = await getSession();
    const isSuperAdmin = session.role === 'super_admin';

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const teamId = searchParams.get('teamId');

    if (!type) {
      return NextResponse.json({ error: '缺少导出类型参数' }, { status: 400 });
    }

    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'players':
        if (!teamId && !isSuperAdmin) {
          return NextResponse.json({ error: '普通管理员必须指定团队' }, { status: 400 });
        }
        if (teamId && !(await hasTeamPermission(teamId))) {
          return NextResponse.json({ error: '无权访问该团队' }, { status: 403 });
        }
        csvContent = await exportPlayers(teamId);
        filename = `players-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'logs':
        if (!teamId && !isSuperAdmin) {
          return NextResponse.json({ error: '普通管理员必须指定团队' }, { status: 400 });
        }
        if (teamId && !(await hasTeamPermission(teamId))) {
          return NextResponse.json({ error: '无权访问该团队' }, { status: 403 });
        }
        csvContent = await exportLogs(teamId);
        filename = `dkp-logs-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'teams':
        if (!isSuperAdmin) {
          return NextResponse.json({ error: '只有超级管理员可以导出团队列表' }, { status: 403 });
        }
        csvContent = await exportTeams();
        filename = `teams-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      default:
        return NextResponse.json({ error: '无效的导出类型' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}

async function exportPlayers(teamId: string | null): Promise<string> {
  const where = teamId ? { teamId } : {};

  const players = await prisma.player.findMany({
    where,
    include: {
      team: { select: { name: true } },
    },
    orderBy: { currentDkp: 'desc' },
  });

  const header = 'name,class,team,current_dkp,total_earned,total_spent,attendance\n';
  const rows = players
    .map((player) =>
      [
        escapeCSV(player.name),
        escapeCSV(player.class),
        escapeCSV(player.team.name),
        player.currentDkp.toFixed(2),
        player.totalEarned.toFixed(2),
        player.totalSpent.toFixed(2),
        player.attendance.toFixed(2),
      ].join(','),
    )
    .join('\n');

  return '\uFEFF' + header + rows;
}

async function exportLogs(teamId: string | null): Promise<string> {
  const where: any = { isDeleted: false };
  if (teamId) {
    where.teamId = teamId;
  }

  const logs = await prisma.dkpLog.findMany({
    where,
    include: {
      player: { select: { name: true } },
      team: { select: { name: true } },
      event: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const header = 'timestamp,player_name,team,type,change,reason,item,boss,operator\n';
  const rows = logs
    .map((log) => {
      const changeValue = log.change ?? log.event?.change ?? 0;
      const reasonValue = log.reason ?? log.event?.reason ?? '';
      const itemValue = log.item ?? log.event?.item ?? '';
      const bossValue = log.boss ?? log.event?.boss ?? '';
      const timestamp = log.event?.eventTime ?? log.createdAt;
      const operatorValue = log.operator || log.event?.operator || '';

      return [
        escapeCSV(new Date(timestamp).toISOString()),
        escapeCSV(log.player.name),
        escapeCSV(log.team.name),
        escapeCSV(log.type),
        changeValue.toFixed(2),
        escapeCSV(reasonValue),
        escapeCSV(itemValue),
        escapeCSV(bossValue),
        escapeCSV(operatorValue),
      ].join(',');
    })
    .join('\n');

  return '\uFEFF' + header + rows;
}

async function exportTeams(): Promise<string> {
  const teams = await prisma.team.findMany({
    include: {
      _count: {
        select: {
          players: true,
          dkpLogs: true,
        },
      },
    },
  });

  const header = 'team_name,description,player_count,total_logs,created_at\n';
  const rows = teams
    .map((team) => {
      return [
        escapeCSV(team.name),
        escapeCSV(team.description || ''),
        team._count.players.toString(),
        team._count.dkpLogs.toString(),
        escapeCSV(new Date(team.createdAt).toISOString()),
      ].join(',');
    })
    .join('\n');

  return '\uFEFF' + header + rows;
}

function escapeCSV(value: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}
