import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WOW_CLASSES = [
  '战士', '圣骑士', '猎人', '盗贼', '牧师',
  '萨满祭司', '法师', '术士', '德鲁伊'
];

async function main() {
  console.log('🌱 开始初始化数据...');

  // 1. 创建超级管理员
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'wow@admin123';

  const existingAdmin = await prisma.admin.findUnique({
    where: { username: adminUsername },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const superAdmin = await prisma.admin.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        role: 'super_admin',
        isActive: true,
        needPasswordChange: false,
      },
    });
    console.log(`✅ 创建超级管理员: ${adminUsername}`);

    // 为超级管理员授予所有团队权限（后续创建团队时自动授权）
  } else {
    console.log(`✅ 超级管理员已存在: ${adminUsername}`);
  }

  // 2. 创建示例团队
  const team1 = await prisma.team.upsert({
    where: { name: '荣耀公会' },
    update: {},
    create: {
      name: '荣耀公会',
      description: '主力团队，专注黑翼之巢和安其拉',
    },
  });

  const team2 = await prisma.team.upsert({
    where: { name: '开荒小队' },
    update: {},
    create: {
      name: '开荒小队',
      description: '新副本开荒团队',
    },
  });

  console.log('✅ 团队创建完成');

  // 3. 为超级管理员授予所有团队权限
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
    console.log('✅ 超级管理员权限配置完成');
  }

  // 4. 为团队1创建示例玩家
  const playerNames = [
    '无敌小战士', '神圣奶妈', '狂暴猎人', '暗影刺客', '暗牧大佬',
    '元素萨满', '奥术法神', '痛苦术士', '野性德鲁伊', '防护骑士'
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

  console.log('✅ 玩家创建完成');

  // 5. 创建一些示例日志
  const players = await prisma.player.findMany({ where: { teamId: team1.id } });
  
  for (const player of players.slice(0, 5)) {
    await prisma.dkpLog.create({
      data: {
        playerId: player.id,
        teamId: team1.id,
        type: 'earn',
        change: 50,
        boss: '奈法利安',
        reason: '击杀Boss',
        operator: 'system',
      },
    });
  }

  console.log('✅ 日志创建完成');
  console.log('');
  console.log('🎉 数据初始化完成！');
  console.log('');
  console.log('📌 管理员账号信息：');
  console.log(`   用户名: ${adminUsername}`);
  console.log(`   密码: ${adminPassword}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });