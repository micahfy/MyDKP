import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/export?type=players&teamId=xxx
// GET /api/export?type=logs&teamId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'players' | 'logs' | 'teams'
    const teamId = searchParams.get('teamId');

    if (!type) {
      return NextResponse.json(
        { error: '缺少导出类型参数' },
        { status: 400 }
      );
    }

    let csvContent = '';
    let filename = '';

    switch (type) {
      case 'players':
        csvContent = await exportPlayers(teamId);
        filename = `players-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'logs':
        csvContent = await exportLogs(teamId);
        filename = `dkp-logs-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'teams':
        csvContent = await exportTeams();
        filename = `teams-${new Date().toISOString().split('T')[0]}.csv`;
        break;

      default:
        return NextResponse.json(
          { error: '无效的导出类型' },
          { status: 400 }
        );
    }

    // 返回 CSV 文件
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: '导出失败' },
      { status: 500 }
    );
  }
}

// 导出玩家数据
async function exportPlayers(teamId: string | null): Promise<string> {
  const where = teamId ? { teamId } : {};
  
  const players = await prisma.player.findMany({
    where,
    include: {
      team: {
        select: { name: true },
      },
    },
    orderBy: { currentDkp: 'desc' },
  });

  // CSV 头部
  const header = 'name,class,team,current_dkp,total_earned,total_spent,attendance\n';
  
  // CSV 数据行
  const rows = players.map((player) => {
    return [
      escapeCSV(player.name),
      escapeCSV(player.class),
      escapeCSV(player.team.name),
      player.currentDkp.toFixed(2),
      player.totalEarned.toFixed(2),
      player.totalSpent.toFixed(2),
      player.attendance.toFixed(2),
    ].join(',');
  }).join('\n');

  // 添加 BOM 以支持 Excel 正确显示中文
  return '\uFEFF' + header + rows;
}

// 导出 DKP 日志
async function exportLogs(teamId: string | null): Promise<string> {
  const where = teamId ? { teamId } : {};
  
  const logs = await prisma.dkpLog.findMany({
    where,
    include: {
      player: {
        select: { name: true },
      },
      team: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000, // 限制导出最近 1000 条记录
  });

  // CSV 头部
  const header = 'timestamp,player_name,team,type,change,reason,item,boss,operator\n';
  
  // CSV 数据行
  const rows = logs.map((log) => {
    return [
      escapeCSV(new Date(log.createdAt).toISOString()),
      escapeCSV(log.player.name),
      escapeCSV(log.team.name),
      escapeCSV(log.type),
      log.change.toFixed(2),
      escapeCSV(log.reason || ''),
      escapeCSV(log.item || ''),
      escapeCSV(log.boss || ''),
      escapeCSV(log.operator),
    ].join(',');
  }).join('\n');

  return '\uFEFF' + header + rows;
}

// 导出团队列表
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

  // CSV 头部
  const header = 'team_name,description,player_count,total_logs,created_at\n';
  
  // CSV 数据行
  const rows = teams.map((team) => {
    return [
      escapeCSV(team.name),
      escapeCSV(team.description || ''),
      team._count.players.toString(),
      team._count.dkpLogs.toString(),
      escapeCSV(new Date(team.createdAt).toISOString()),
    ].join(',');
  }).join('\n');

  return '\uFEFF' + header + rows;
}

// CSV 字段转义（处理逗号、引号、换行符）
function escapeCSV(value: string): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // 如果包含逗号、引号或换行符，需要用双引号包裹，并转义内部的双引号
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}