import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildKey(log: any) {
  return [
    log.teamId,
    log.type,
    log.change ?? 0,
    log.reason ?? '',
    log.item ?? '',
    log.boss ?? '',
    log.operator ?? '',
    log.createdAt.toISOString(),
  ].join('|');
}

async function main() {
  const logs = await prisma.dkpLog.findMany({
    orderBy: { createdAt: 'asc' },
    where: { eventId: null },
  });

  console.log(`Processing ${logs.length} logs...`);
  const cache = new Map<string, string>();
  let createdEvents = 0;

  for (const log of logs) {
    const key = buildKey(log);
    let eventId: string | undefined = cache.get(key);

    if (!eventId) {
      const event = await prisma.dkpEvent.create({
        data: {
          teamId: log.teamId,
          type: log.type,
          change: log.change ?? 0,
          reason: log.reason,
          item: log.item,
          boss: log.boss,
          operator: log.operator,
          eventTime: log.createdAt,
        },
      });
      eventId = event.id;
      cache.set(key, eventId);
      createdEvents += 1;
    }

    if (!eventId) {
      throw new Error(`Failed to resolve event for log ${log.id}`);
    }

    await prisma.dkpLog.update({
      where: { id: log.id },
      data: {
        eventId,
        change: null,
        reason: null,
        item: null,
        boss: null,
      },
    });
  }

  console.log(`Created ${createdEvents} events and updated ${logs.length} logs.`);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
