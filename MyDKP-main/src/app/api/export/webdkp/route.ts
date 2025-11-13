import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdmin, getSession, getAdminTeams } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function luaEscape(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const session = await getSession();
  const isSuperAdmin = session.role === 'super_admin';

  const players = await prisma.player.findMany({
    select: {
      id: true,
      name: true,
      class: true,
      currentDkp: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { team: { name: 'asc' } },
      { name: 'asc' },
    ],
  });

  // 过滤没有权限的团队
  let filteredPlayers = players;
  if (!isSuperAdmin) {
    const adminTeams = await getAdminTeams();
    filteredPlayers = players.filter(
      (player) => player.team && adminTeams.includes(player.team.id)
    );
  }

  const lines: string[] = [];
  lines.push('WebDKP_DkpTable = {');

  filteredPlayers.forEach((player, index) => {
    const isLast = index === filteredPlayers.length - 1;
    lines.push(`\t["${luaEscape(player.name)}"] = {`);
    lines.push(`\t\t["playerId"] = "${player.id}",`);
    lines.push(`\t\t["class"] = "${luaEscape(player.class)}",`);
    lines.push(`\t\t["team"] = "${luaEscape(player.team?.name)}",`);
    lines.push(`\t\t["dkp1"] = 0,`);
    lines.push(`\t\t["dkp_1"] = ${Number(player.currentDkp).toFixed(2)},`);
    lines.push(`\t\t["Selected"] = false,`);
    lines.push(isLast ? '\t}' : '\t},');
  });

  lines.push('}');

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="webdkp.lua"',
    },
  });
}
