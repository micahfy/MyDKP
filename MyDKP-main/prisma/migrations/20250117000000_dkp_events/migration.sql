-- Create table for shared DKP events
CREATE TABLE "dkp_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "change" REAL NOT NULL,
    "reason" TEXT,
    "item" TEXT,
    "boss" TEXT,
    "operator" TEXT NOT NULL,
    "eventTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dkp_events_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "dkp_events_teamId_eventTime_idx" ON "dkp_events"("teamId", "eventTime");

-- Rebuild dkp_logs to add eventId column and allow nullable change/reason/item/boss
CREATE TABLE "new_dkp_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "change" REAL,
    "reason" TEXT,
    "item" TEXT,
    "boss" TEXT,
    "operator" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "deletedByAdminId" TEXT,
    "decayHistoryId" TEXT,
    "eventId" TEXT,
    CONSTRAINT "new_dkp_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_dkp_logs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "new_dkp_logs_deletedByAdminId_fkey" FOREIGN KEY ("deletedByAdminId") REFERENCES "admins" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "new_dkp_logs_decayHistoryId_fkey" FOREIGN KEY ("decayHistoryId") REFERENCES "decay_history" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "new_dkp_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "dkp_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_dkp_logs" (
    "id",
    "playerId",
    "teamId",
    "type",
    "change",
    "reason",
    "item",
    "boss",
    "operator",
    "createdAt",
    "isDeleted",
    "deletedAt",
    "deletedByAdminId",
    "decayHistoryId",
    "eventId"
)
SELECT
    "id",
    "playerId",
    "teamId",
    "type",
    "change",
    "reason",
    "item",
    "boss",
    "operator",
    "createdAt",
    "isDeleted",
    "deletedAt",
    "deletedByAdminId",
    "decayHistoryId",
    NULL
FROM "dkp_logs";

DROP TABLE "dkp_logs";
ALTER TABLE "new_dkp_logs" RENAME TO "dkp_logs";
