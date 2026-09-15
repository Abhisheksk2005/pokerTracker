-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "notes" TEXT,
    "defaultBuyIn" INTEGER NOT NULL DEFAULT 2000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GameEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "buyIn" INTEGER NOT NULL DEFAULT 0,
    "cashOut" INTEGER NOT NULL DEFAULT 0,
    "rebuys" INTEGER NOT NULL DEFAULT 0,
    "adjustment" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "GameEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GameEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "gameId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE INDEX "Game_date_idx" ON "Game"("date");

-- CreateIndex
CREATE INDEX "GameEntry_playerId_idx" ON "GameEntry"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEntry_gameId_playerId_key" ON "GameEntry"("gameId", "playerId");

-- CreateIndex
CREATE INDEX "Transaction_playerId_date_idx" ON "Transaction"("playerId", "date");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
