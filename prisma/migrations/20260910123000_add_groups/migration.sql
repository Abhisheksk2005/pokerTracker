-- Add a durable group boundary while preserving every existing row in the
-- original single league. The nullable foreign keys allow a safe in-place
-- migration; application writes always attach new records to the active group.

CREATE TABLE "PokerGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "inviteCode" TEXT NOT NULL,
    "accent" TEXT NOT NULL DEFAULT '#ff6a4d',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("groupId", "playerId"),
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PokerGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PokerGroup_inviteCode_key" ON "PokerGroup"("inviteCode");
CREATE INDEX "GroupMember_playerId_idx" ON "GroupMember"("playerId");

INSERT INTO "PokerGroup" ("id", "name", "description", "inviteCode", "accent", "updatedAt")
VALUES ('default-group', 'Friday Night Poker', 'The original PKRTrackr league and all of its history.', 'HOME-ACES', '#ff6a4d', CURRENT_TIMESTAMP);

INSERT INTO "GroupMember" ("groupId", "playerId", "role", "active")
SELECT 'default-group', "id",
       CASE WHEN "name" = 'Mark' THEN 'OWNER' WHEN "name" = 'Cam' THEN 'ADMIN' ELSE 'MEMBER' END,
       "active"
FROM "Player";

ALTER TABLE "Game" ADD COLUMN "groupId" TEXT REFERENCES "PokerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "Game" SET "groupId" = 'default-group' WHERE "groupId" IS NULL;
DROP INDEX "Game_date_idx";
CREATE INDEX "Game_groupId_date_idx" ON "Game"("groupId", "date");

ALTER TABLE "Transaction" ADD COLUMN "groupId" TEXT REFERENCES "PokerGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
UPDATE "Transaction" SET "groupId" = 'default-group' WHERE "groupId" IS NULL;
CREATE INDEX "Transaction_groupId_date_idx" ON "Transaction"("groupId", "date");
