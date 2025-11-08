import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 开始迁移到多管理员系统...');

  try {
    // 获取环境变量中的管理员账号
    const envUsername = process.env.ADMIN_USERNAME || 'admin';
    const envPassword = process.env.ADMIN_PASSWORD || 'wow@admin123';

    // 检查是否已存在管理员
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: envUsername },
    });

    if (existingAdmin) {
      console.log(`✅ 超级管理员 ${envUsername} 已存在，跳过创建`);
    } else {
      // 创建超级管理员
      const hashedPassword = await bcrypt.hash(envPassword, 10);
      
      await prisma.admin.create({
        data: {
          username: envUsername,
          password: hashedPassword,
          role: 'super_admin',
          isActive: true,
        },
      });

      console.log(`✅ 创建超级管理员: ${envUsername}`);
    }

    // 为超级管理员授予所有团队权限
    const allTeams = await prisma.team.findMany();
    const superAdmin = await prisma.admin.findUnique({
      where: { username: envUsername },
    });

    if (superAdmin) {
      for (const team of allTeams) {
        const existing = await prisma.teamPermission.findUnique({
          where: {
            adminId_teamId: {
              adminId: superAdmin.id,
              teamId: team.id,
            },
          },
        });

        if (!existing) {
          await prisma.teamPermission.create({
            data: {
              adminId: superAdmin.id,
              teamId: team.id,
            },
          });
          console.log(`✅ 授予超级管理员对团队 ${team.name} 的权限`);
        }
      }
    }

    console.log('🎉 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();