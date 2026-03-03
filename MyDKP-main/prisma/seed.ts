import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WOW_CLASSES = [
  'Warrior',
  'Paladin',
  'Hunter',
  'Rogue',
  'Priest',
  'Shaman',
  'Mage',
  'Warlock',
  'Druid',
];

async function main() {
  console.log('[seed] start');

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'wow@admin123';
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null;

  const existingAdmin = await prisma.admin.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.admin.create({
      data: {
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'super_admin',
        isActive: true,
        needPasswordChange: false,
      },
    });
    console.log(`[seed] created super admin: ${adminUsername}`);
  } else {
    console.log(`[seed] super admin exists: ${adminUsername}`);
  }

  const team1 = await prisma.team.upsert({
    where: {
      serverName_guildName_name: {
        serverName: 'default-server',
        guildName: 'default-guild',
        name: 'GloryGuild',
      },
    },
    update: {},
    create: {
      name: 'GloryGuild',
      serverName: 'default-server',
      guildName: 'default-guild',
      slug: 'gloryguild',
      description: 'Main raid team',
    },
  });

  await prisma.team.upsert({
    where: {
      serverName_guildName_name: {
        serverName: 'default-server',
        guildName: 'default-guild',
        name: 'Progression',
      },
    },
    update: {},
    create: {
      name: 'Progression',
      serverName: 'default-server',
      guildName: 'default-guild',
      slug: 'progression',
      description: 'Progression team',
    },
  });

  const admin = await prisma.admin.findUnique({
    where: { username: adminUsername },
  });

  if (admin) {
    const teams = await prisma.team.findMany();
    for (const team of teams) {
      await prisma.teamPermission.upsert({
        where: {
          adminId_teamId: {
            adminId: admin.id,
            teamId: team.id,
          },
        },
        update: {},
        create: {
          adminId: admin.id,
          teamId: team.id,
        },
      });
    }
    console.log('[seed] ensured super admin team permissions');
  }

  const playerNames = [
    'TankOne',
    'HolyOne',
    'HunterOne',
    'RogueOne',
    'PriestOne',
    'ShamanOne',
    'MageOne',
    'WarlockOne',
    'DruidOne',
    'PaladinOne',
  ];

  for (let i = 0; i < playerNames.length; i++) {
    await prisma.player.upsert({
      where: {
        name_teamId: {
          name: playerNames[i],
          teamId: team1.id,
        },
      },
      update: {},
      create: {
        name: playerNames[i],
        class: WOW_CLASSES[i % WOW_CLASSES.length],
        currentDkp: Math.floor(Math.random() * 500) + 100,
        totalEarned: Math.floor(Math.random() * 1000) + 200,
        totalSpent: Math.floor(Math.random() * 300),
        attendance: Math.random() * 0.3 + 0.7,
        teamId: team1.id,
      },
    });
  }

  const players = await prisma.player.findMany({ where: { teamId: team1.id } });
  for (const player of players.slice(0, 5)) {
    const event = await prisma.dkpEvent.create({
      data: {
        teamId: team1.id,
        type: 'earn',
        change: 50,
        boss: 'Nefarian',
        reason: 'Boss kill',
        operator: 'system',
        eventTime: new Date(),
      },
    });

    await prisma.dkpLog.create({
      data: {
        playerId: player.id,
        teamId: team1.id,
        type: 'earn',
        change: 50,
        reason: 'Boss kill',
        operator: 'system',
        createdAt: event.eventTime,
        eventId: event.id,
      },
    });
  }

  console.log('[seed] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
