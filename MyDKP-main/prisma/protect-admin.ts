import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function protectAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  console.log(`🛡️  正在设置 ${adminUsername} 为受保护账号...`);

  try {
    const admin = await prisma.admin.findUnique({
      where: { username: adminUsername },
    });

    if (!admin) {
      console.error(`❌ 管理员 ${adminUsername} 不存在`);
      process.exit(1);
    }

    await prisma.admin.update({
      where: { username: adminUsername },
      data: { isProtected: true },
    });

    console.log(`✅ ${adminUsername} 已设置为受保护账号`);
    console.log('   该账号现在无法被其他管理员降级或删除');
  } catch (error) {
    console.error('❌ 设置失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

protectAdmin();