/* eslint-disable */
// @ts-nocheck

/**
 * 说明：
 * 1) 此脚本用于将现有 SQLite 数据同步到 PostgreSQL。
 * 2) Prisma 针对不同数据库的 createMany 参数略有差异，skipDuplicates 在部分驱动上没有类型声明，
 *    会导致 TS 报 “true is not assignable to never”。为保持可执行且不影响构建，这里关闭 TS 检查。
 */

import { PrismaClient } from '@prisma/client';

// 默认读取两个环境变量指定数据源，可按需调整
const sqlite = new PrismaClient({
  datasources: { db: { url: process.env.SQLITE_URL || 'file:./prisma/dev.db' } },
});

const pg = new PrismaClient({
  datasources: { db: { url: process.env.PG_URL || process.env.DATABASE_URL || '' } },
});

async function main() {
  console.log('Start copying data from SQLite to PostgreSQL...');

  // 基础表
  const teams = await sqlite.team.findMany();
  await pg.team.createMany({ data: teams });

  const players = await sqlite.player.findMany();
  await pg.player.createMany({ data: players });

  const admins = await sqlite.admin.findMany();
  await pg.admin.createMany({ data: admins });

  const teamPermissions = await sqlite.teamPermission.findMany();
  await pg.teamPermission.createMany({ data: teamPermissions });

  // 业务表
  const lootItems = await sqlite.lootItem.findMany();
  await pg.lootItem.createMany({ data: lootItems });

  const decayHistory = await sqlite.decayHistory.findMany();
  await pg.decayHistory.createMany({ data: decayHistory });

  const dkpEvents = await sqlite.dkpEvent.findMany();
  await pg.dkpEvent.createMany({ data: dkpEvents });

  const dkpLogs = await sqlite.dkpLog.findMany();
  await pg.dkpLog.createMany({ data: dkpLogs });

  const webdkpSessions = await sqlite.webdkpSession.findMany();
  await pg.webdkpSession.createMany({ data: webdkpSessions });

  console.log('✅ Copy completed.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });
