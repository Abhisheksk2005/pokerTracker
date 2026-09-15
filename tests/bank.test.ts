import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { bankAmount, bankSummary } from "../src/lib/bank";
import { runBankCommand, startBankGame, type BankCommand } from "../src/lib/bank-service";

test("strict amounts reject malformed, negative, excessive precision and zero inputs", () => {
  for (const value of ["", "-1", "1e3", "NaN", "10.001", "money20", "0", "Infinity"]) assert.throws(() => bankAmount(value));
  assert.equal(bankAmount("10.25"), 1025);
  assert.equal(bankAmount("0", true), 0);
});

test("game bank preserves chips, debts and immutable initial buy-ins", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "pkr-bank-test-"));
  const file = path.join(directory, "test.db");
  // Same driver as production (libSQL), against a throwaway local file.
  const sql = createClient({ url: `file:${file}` });
  for (const migration of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) await sql.executeMultiple(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
  sql.close();
  const db = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${file}` }) });
  try {
    const group = await db.pokerGroup.create({ data: { name: "Test table", inviteCode: randomUUID() } });
    const other = await db.pokerGroup.create({ data: { name: "Other table", inviteCode: randomUUID() } });
    const setup = (paid = true, capacity: number | null = 20_000, openingCash = 0) => ({ name: "Test game", date: new Date(), defaultBuyIn: 10_000, chipBankSize: capacity, openingCash, requestId: randomUUID(), seats: [{ name: "Test A", amount: 10_000, paid }, { name: "Test B", amount: 10_000, paid }] });
    const snapshot = async (id: string) => { const game = await db.game.findUniqueOrThrow({ where: { id }, include: { bankOperations: true, entries: { include: { player: true } } } }); return { game, summary: bankSummary(game.bankOperations, game.chipBankSize, game.openingCash) }; };
    const command = async (gameId: string, values: Partial<BankCommand> & Pick<BankCommand, "action">) => runBankCommand(db, { groupId: group.id, gameId, version: (await snapshot(gameId)).game.bankVersion, ...values });

    await t.test("setup saves and reuses profiles atomically and repeated submission starts only one game", async () => {
      const input = setup();
      const id = await startBankGame(db, group.id, input);
      assert.equal(await startBankGame(db, group.id, input), id);
      assert.equal(await db.player.count(), 2);
      assert.equal(await db.groupMember.count({ where: { groupId: group.id } }), 2);
      assert.equal((await snapshot(id)).summary.bankCash, 20_000);
      await assert.rejects(startBankGame(db, other.id, { ...setup(), seats: [{ name: "Rollback profile", amount: 50_000, paid: true }], chipBankSize: 1000 }), /Not enough chips/);
      assert.equal(await db.player.count({ where: { name: "Rollback profile" } }), 0);
    });

    await t.test("initial buy-in is locked while extra buy-ins can be cleared in parts, exactly once", async () => {
      const id = await startBankGame(db, group.id, setup(false, null));
      const first = await snapshot(id);
      const a = first.game.entries.find((entry) => entry.player.name === "Test A")!.playerId;
      const initial = first.game.bankOperations.find((row) => row.playerId === a && row.kind === "INITIAL_BUY_IN")!;
      await assert.rejects(command(id, { action: "CLEAR", operationId: initial.id, amount: 10_000 }), /initial buy-in is locked/);
      await assert.rejects(command(id, { action: "UNDO", batchId: initial.batchId }), /initial buy-in is locked/);
      await command(id, { action: "BUY_IN", playerId: a, amount: 5_000 });
      const extra = (await snapshot(id)).game.bankOperations.find((row) => row.kind === "BUY_IN")!;
      await command(id, { action: "CLEAR", operationId: extra.id, amount: 2_000 });
      const version = (await snapshot(id)).game.bankVersion;
      await runBankCommand(db, { groupId: group.id, gameId: id, version, action: "CLEAR", operationId: extra.id, amount: 3_000 });
      await assert.rejects(runBankCommand(db, { groupId: group.id, gameId: id, version, action: "CLEAR", operationId: extra.id, amount: 3_000 }), /changed in another window/);
      const result = await snapshot(id);
      assert.equal(result.summary.bankCash, 5_000);
      assert.equal(result.summary.dues.find((row) => row.id === initial.id)!.remaining, 10_000);
      assert.equal(result.summary.dues.find((row) => row.id === extra.id)!.remaining, 0);
      assert.equal(result.game.entries.find((row) => row.playerId === a)!.buyIn, 15_000);
    });

    await t.test("recycling records debt to A and B's buy-in without creating physical chips or cash", async () => {
      const id = await startBankGame(db, group.id, setup());
      const entries = (await snapshot(id)).game.entries;
      const a = entries.find((row) => row.player.name === "Test A")!.playerId;
      const b = entries.find((row) => row.player.name === "Test B")!.playerId;
      await assert.rejects(command(id, { action: "BUY_IN", playerId: b, amount: 5000 }), /Not enough chips/);
      await command(id, { action: "RECYCLE", playerId: a, recipientId: b, amount: 5000 });
      let current = await snapshot(id);
      assert.equal(current.summary.chipsInPlay, 20_000);
      assert.equal(current.summary.chipsAvailable, 0);
      assert.equal(current.summary.bankCash, 20_000);
      assert.equal(current.summary.players.find((row) => row.playerId === a)!.bankOwes, 5000);
      assert.equal(current.summary.players.find((row) => row.playerId === b)!.owesBank, 5000);
      const buyIn = current.summary.dues.find((row) => row.kind === "BUY_IN")!;
      const loan = current.summary.dues.find((row) => row.kind === "CHIP_RETURN")!;
      await command(id, { action: "CLEAR", operationId: buyIn.id, amount: 5000 });
      await command(id, { action: "CLEAR", operationId: loan.id, amount: 5000 });
      await assert.rejects(command(id, { action: "UNDO", batchId: loan.batchId }), /linked payment first/);
      await command(id, { action: "CASH_OUT", playerId: b, amount: 20_000 });
      await command(id, { action: "CLOSE" });
      await command(id, { action: "SETTLE", playerId: b });
      current = await snapshot(id);
      assert.equal(current.summary.chipsInPlay, 0);
      assert.equal(current.summary.bankCash, 0);
      assert.equal(current.summary.owedToBank + current.summary.owedToPlayers, 0);
      assert.equal(current.game.entries.reduce((sum, row) => sum + row.cashOut - row.buyIn, 0), 0);
      assert.equal((await db.transaction.aggregate({ where: { gameId: id }, _sum: { amount: true } }))._sum.amount, 0);
    });

    await t.test("cash shortages, over-returned chips and another group's actions roll back everything", async () => {
      const id = await startBankGame(db, group.id, setup(false));
      const before = await snapshot(id);
      const a = before.game.entries[0].playerId;
      await assert.rejects(command(id, { action: "CASH_OUT", playerId: a, amount: 1000, paid: true }), /not collected enough cash/);
      await assert.rejects(command(id, { action: "CASH_OUT", playerId: a, amount: 30_000 }), /more chips/);
      await assert.rejects(command(id, { action: "CLOSE" }), /remaining chip stack/);
      await assert.rejects(command(id, { action: "BUY_IN", groupId: other.id, playerId: a, amount: 1000 }), /changed in another window/);
      const after = await snapshot(id);
      assert.equal(after.game.bankVersion, before.game.bankVersion);
      assert.equal(after.game.bankOperations.length, before.game.bankOperations.length);
    });

    await t.test("correction undoes both halves of a recycle and keeps an audit trail", async () => {
      const id = await startBankGame(db, group.id, setup());
      const [a,b] = (await snapshot(id)).game.entries;
      await command(id, { action: "RECYCLE", playerId: a.playerId, recipientId: b.playerId, amount: 2000, paid: true });
      const recycled = (await snapshot(id)).game.bankOperations.find((row) => row.kind === "CHIP_RETURN")!;
      await command(id, { action: "UNDO", batchId: recycled.batchId });
      const after = await snapshot(id);
      assert.equal(after.summary.totalBuyIn, 20_000);
      assert.equal(after.summary.totalReturned, 0);
      assert.equal(after.summary.bankCash, 20_000);
      assert.equal(after.game.bankOperations.filter((row) => row.batchId === recycled.batchId && row.voidedAt).length, 3);
    });

    await t.test("mid-game settlement leaves initial debt locked and offsets only extra buy-ins", async () => {
      const id = await startBankGame(db, group.id, setup(false, null));
      const a = (await snapshot(id)).game.entries[0].playerId;
      await command(id, { action: "BUY_IN", playerId: a, amount: 5000 });
      await command(id, { action: "CASH_OUT", playerId: a, amount: 5000 });
      await command(id, { action: "SETTLE", playerId: a });
      const result = await snapshot(id);
      assert.equal(result.summary.players.find((p) => p.playerId === a)!.owesBank, 10_000);
      assert.equal(result.summary.players.find((p) => p.playerId === a)!.bankOwes, 0);
      assert.equal(await db.transaction.count({ where: { gameId: id } }), 0);
      await assert.rejects(command(id, { action: "SETTLE", playerId: a }), /locked initial buy-in remains/);
    });

    await t.test("late arrivals reuse saved profiles and their opening amount remains locked", async () => {
      const id = await startBankGame(db, group.id, setup(true, null));
      const saved = await db.player.create({ data: { name: "Late guest" } });
      await command(id, { action: "SEAT", playerId: saved.id, amount: 1000, paid: true });
      const after = await snapshot(id);
      assert.equal(after.game.entries.length, 3);
      assert.equal(after.summary.bankCash, 21_000);
      const initial = after.summary.dues.find((row) => row.playerId === saved.id)!;
      assert.equal(initial.kind, "INITIAL_BUY_IN");
      await assert.rejects(command(id, { action: "SEAT", playerId: saved.id, amount: 1000 }), /already seated/);
    });

    await t.test("legacy conversion preserves totals, rebuy counts and existing ledger payments", async () => {
      const a = await db.player.findFirstOrThrow({ where: { name: "Test A" } });
      const legacy = await db.game.create({ data: { groupId: group.id, name: "Legacy", date: new Date(), entries: { create: { playerId: a.id, buyIn: 20_000, rebuys: 2, cashOut: 5000 } } } });
      await db.transaction.create({ data: { gameId: legacy.id, groupId: group.id, playerId: a.id, date: new Date(), type: "BUY_IN", amount: -20_000 } });
      await command(legacy.id, { action: "ENABLE" });
      const result = await snapshot(legacy.id);
      assert.equal(result.summary.bankCash, 20_000);
      assert.equal(result.summary.chipsInPlay, 15_000);
      assert.equal(result.summary.owedToPlayers, 5000);
      assert.equal(result.game.entries[0].rebuys, 2);
      assert.equal(await db.transaction.count({ where: { gameId: legacy.id } }), 1);
      assert.ok((await db.transaction.findFirstOrThrow({ where: { gameId: legacy.id } })).operationId);
    });

    await t.test("final settlement offsets unpaid opening buy-ins without inventing cash movements", async () => {
      const id = await startBankGame(db, group.id, setup(false));
      const [a,b] = (await snapshot(id)).game.entries;
      await command(id, { action: "CASH_OUT", playerId: a.playerId, amount: 10_000 });
      await command(id, { action: "CASH_OUT", playerId: b.playerId, amount: 10_000 });
      await command(id, { action: "CLOSE" });
      await command(id, { action: "SETTLE", playerId: a.playerId });
      await command(id, { action: "SETTLE", playerId: b.playerId });
      const result = await snapshot(id);
      assert.equal(result.summary.owedToBank + result.summary.owedToPlayers, 0);
      assert.equal(await db.transaction.count({ where: { gameId: id } }), 0);
      assert.equal(result.summary.totalBuyIn, 20_000);
      assert.equal(result.game.bankOperations.filter((row) => row.kind === "INITIAL_BUY_IN" && !row.voidedAt).length, 2);
    });
  } finally {
    await db.$disconnect();
    // libSQL can hold the file briefly after disconnect on Windows; a leftover temp dir is harmless.
    try {
      rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      console.warn(`[test] could not remove ${directory}`);
    }
  }
});
