import { prisma } from '@/lib/prisma';

function toBeijingDate(date: Date): string {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = beijing.getUTCFullYear();
  const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijing.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 根据出席日志或“集合分”记录计算团队出席率
 */
export async function recalculateTeamAttendance(teamId: string) {
  const [attendanceLogs, players] = await Promise.all([
    prisma.dkpLog.findMany({
      where: {
        teamId,
        isDeleted: false,
        OR: [
          { type: 'attendance' },
          {
            reason: {
              contains: '集合分',
            },
          },
        ],
      },
      select: { playerId: true, createdAt: true },
    }),
    prisma.player.findMany({
      where: { teamId },
      select: { id: true },
    }),
  ]);

  if (players.length === 0) {
    return;
  }

  if (attendanceLogs.length === 0) {
    await prisma.player.updateMany({
      where: { teamId },
      data: { attendance: 0 },
    });
    return;
  }

  const dayToPlayers = new Map<string, Set<string>>();

  for (const log of attendanceLogs) {
    const dateStr = toBeijingDate(new Date(log.createdAt));
    if (!dayToPlayers.has(dateStr)) {
      dayToPlayers.set(dateStr, new Set());
    }
    dayToPlayers.get(dateStr)!.add(log.playerId);
  }

  const totalDays = dayToPlayers.size;

  await Promise.all(
    players.map(({ id }) => {
      let attendedDays = 0;
      for (const playersOfDay of dayToPlayers.values()) {
        if (playersOfDay.has(id)) {
          attendedDays++;
        }
      }
      const attendance = totalDays === 0 ? 0 : attendedDays / totalDays;
      return prisma.player.update({
        where: { id },
        data: { attendance },
      });
    })
  );
}
