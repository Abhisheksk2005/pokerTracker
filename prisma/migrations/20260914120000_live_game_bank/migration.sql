ALTER TABLE "Game" ADD COLUMN "bankTracking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Game" ADD COLUMN "bankVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN "chipBankSize" INTEGER;
ALTER TABLE "Game" ADD COLUMN "openingCash" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN "startRequestId" TEXT;
CREATE UNIQUE INDEX "Game_startRequestId_key" ON "Game"("startRequestId");
CREATE TABLE "GameOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "gameId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "batchId" TEXT NOT NULL,
  "relatedId" TEXT,
  "rebuyCount" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" DATETIME,
  CONSTRAINT "GameOperation_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GameOperation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "GameOperation_gameId_createdAt_idx" ON "GameOperation"("gameId", "createdAt");
CREATE INDEX "GameOperation_relatedId_idx" ON "GameOperation"("relatedId");
CREATE INDEX "GameOperation_batchId_idx" ON "GameOperation"("batchId");
ALTER TABLE "Transaction" ADD COLUMN "operationId" TEXT REFERENCES "GameOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Transaction_operationId_key" ON "Transaction"("operationId");
