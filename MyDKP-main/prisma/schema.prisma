generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Admin {
  id              String   @id @default(cuid())
  username        String   @unique
  password        String
  role            String   @default("admin") // super_admin, admin
  isActive        Boolean  @default(true)
  needPasswordChange Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastLoginAt     DateTime?

  teamPermissions TeamPermission[]

  @@map("admins")
}

model TeamPermission {
  id        String   @id @default(cuid())
  adminId   String
  teamId    String
  createdAt DateTime @default(now())

  admin Admin @relation(fields: [adminId], references: [id], onDelete: Cascade)
  team  Team  @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([adminId, teamId])
  @@map("team_permissions")
}

model Team {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  players         Player[]
  dkpLogs         DkpLog[]
  decayHistory    DecayHistory[]
  teamPermissions TeamPermission[]

  @@map("teams")
}

model Player {
  id           String   @id @default(cuid())
  name         String
  class        String
  currentDkp   Float    @default(0)
  totalEarned  Float    @default(0)
  totalSpent   Float    @default(0)
  attendance   Float    @default(0)
  teamId       String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  team    Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  dkpLogs DkpLog[]

  @@unique([name, teamId])
  @@map("players")
}

model DkpLog {
  id        String   @id @default(cuid())
  playerId  String
  teamId    String
  type      String
  change    Float
  reason    String?
  item      String?
  boss      String?
  operator  String
  createdAt DateTime @default(now())

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@map("dkp_logs")
}

model DecayHistory {
  id            String   @id @default(cuid())
  teamId        String
  rate          Float
  executedAt    DateTime @default(now())
  status        String   @default("normal")
  operator      String
  affectedCount Int      @default(0)

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@map("decay_history")
}