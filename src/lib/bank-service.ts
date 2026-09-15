import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { assertBankBalanced, bankSummary, BankError, isCharge, isCredit, type BankKind } from "@/lib/bank";

type Tx = Prisma.TransactionClient;
type NewRecord = { gameId: string; playerId: string; kind: BankKind; amount: number; batchId: string; relatedId?: string; rebuyCount?: number; note?: string };

async function record(tx: Tx, groupId: string, data: NewRecord, postCash = true) {
  const operation = await tx.gameOperation.create({ data });
  if (postCash && (data.kind === "PAYMENT_IN" || data.kind === "PAYMENT_OUT")) {
    await tx.transaction.create({ data: {
      groupId, gameId: data.gameId, playerId: data.playerId, operationId: operation.id,
      date: operation.createdAt, type: data.kind, amount: data.kind === "PAYMENT_IN" ? -data.amount : data.amount,
      note: data.note ?? "Cleared through the game bank", method: "CASH",
    } });
  }
  return operation;
}

async function clearRecord(tx: Tx, groupId: string, source: { id: string; gameId: string; playerId: string; kind: string }, amount: number, batchId: string, offset = false) {
  return record(tx, groupId, { gameId: source.gameId, playerId: source.playerId, relatedId: source.id, amount, batchId,
    kind: isCharge(source.kind) ? offset ? "OFFSET_IN" : "PAYMENT_IN" : offset ? "OFFSET_OUT" : "PAYMENT_OUT",
    note: offset ? "Cleared against this player's returned-chip credit; no cash moved" : "Payment recorded in the game bank",
  });
}

export type GameSetup = { name: string; date: Date; defaultBuyIn: number; chipBankSize: number | null; openingCash: number; requestId: string; seats: { playerId?: string; name?: string; amount: number; paid: boolean }[] };

export async function startBankGame(db: PrismaClient, groupId: string, setup: GameSetup) {
  return db.$transaction(async (tx) => {
    const duplicate = await tx.game.findUnique({ where: { startRequestId: setup.requestId } });
    if (duplicate) {
      if (duplicate.groupId !== groupId) throw new BankError("This start request belongs to another group.");
      return duplicate.id;
    }
    if (!await tx.pokerGroup.findUnique({ where: { id: groupId } })) throw new BankError("Select a group first.");
    if (!setup.seats.length || setup.seats.length > 50) throw new BankError("Choose between 1 and 50 players.");
    const allPlayers = await tx.player.findMany({ select: { id: true, name: true } });
    const chosen = new Set<string>();
    const seats: { playerId: string; amount: number; paid: boolean }[] = [];
    for (const seat of setup.seats) {
      let player = seat.playerId ? allPlayers.find((item) => item.id === seat.playerId) : allPlayers.find((item) => item.name.toLowerCase() === seat.name?.trim().toLowerCase());
      if (seat.playerId && !player) throw new BankError("A selected player no longer exists. Reload and choose again.");
      if (!player) {
        const name = seat.name?.trim();
        if (!name || name.length > 80) throw new BankError("Use a player name between 1 and 80 characters.");
        player = await tx.player.create({ data: { name }, select: { id: true, name: true } });
        allPlayers.push(player);
      }
      if (chosen.has(player.id)) throw new BankError(`${player.name} is selected twice. Choose each player once.`);
      if (!Number.isSafeInteger(seat.amount) || seat.amount <= 0) throw new BankError("Every initial buy-in must be greater than zero.");
      chosen.add(player.id);
      await tx.groupMember.upsert({ where: { groupId_playerId: { groupId, playerId: player.id } }, create: { groupId, playerId: player.id }, update: { active: true } });
      seats.push({ ...seat, playerId: player.id });
    }
    const game = await tx.game.create({ data: {
      groupId, name: setup.name, date: setup.date, defaultBuyIn: setup.defaultBuyIn, bankTracking: true,
      chipBankSize: setup.chipBankSize, openingCash: setup.openingCash, startRequestId: setup.requestId,
      entries: { create: seats.map((seat) => ({ playerId: seat.playerId, buyIn: seat.amount })) },
    } });
    for (const seat of seats) {
      const batchId = randomUUID();
      const initial = await record(tx, groupId, { gameId: game.id, playerId: seat.playerId, kind: "INITIAL_BUY_IN", amount: seat.amount, batchId });
      if (seat.paid) await clearRecord(tx, groupId, initial, seat.amount, batchId);
    }
    assertBankBalanced(bankSummary(await tx.gameOperation.findMany({ where: { gameId: game.id } }), game.chipBankSize, game.openingCash));
    return game.id;
  }, { timeout: 20_000 });
}

export type BankCommand = {
  groupId: string; gameId: string; version: number;
  action: "BUY_IN" | "CASH_OUT" | "RECYCLE" | "CLEAR" | "SETTLE" | "UNDO" | "CHIPS" | "CLOSE" | "REOPEN" | "SEAT" | "ENABLE";
  playerId?: string; recipientId?: string; playerName?: string; amount?: number; paid?: boolean; operationId?: string; batchId?: string; chipBankSize?: number | null; openingCash?: number;
};

export async function runBankCommand(db: PrismaClient, command: BankCommand) {
  return db.$transaction(async (tx) => {
    const claimed = await tx.game.updateMany({ where: { id: command.gameId, groupId: command.groupId, bankVersion: command.version }, data: { bankVersion: { increment: 1 } } });
    if (claimed.count !== 1) throw new BankError("This game changed in another window. Refresh and try again; nothing was recorded twice.");
    let game = await tx.game.findUniqueOrThrow({ where: { id: command.gameId }, include: { entries: true, bankOperations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, transactions: true } });
    if (command.action === "ENABLE") {
      if (game.bankTracking) throw new BankError("Live bank tracking is already enabled.");
      if (game.status !== "ACTIVE") throw new BankError("Reopen the night before enabling live bank tracking.");
      for (const entry of game.entries) {
        if (entry.buyIn < 0 || entry.cashOut < 0) throw new BankError("Correct negative legacy amounts before enabling the bank.");
        if (entry.buyIn) await record(tx, command.groupId, { gameId: game.id, playerId: entry.playerId, kind: "INITIAL_BUY_IN", amount: entry.buyIn, rebuyCount: entry.rebuys, batchId: randomUUID(), note: "Imported opening total, including any previous rebuys" });
        if (entry.cashOut) await record(tx, command.groupId, { gameId: game.id, playerId: entry.playerId, kind: "CASH_OUT", amount: entry.cashOut, batchId: randomUUID(), note: "Imported chip returns" });
        if (entry.adjustment) await record(tx, command.groupId, { gameId: game.id, playerId: entry.playerId, kind: entry.adjustment > 0 ? "CREDIT" : "CHARGE", amount: Math.abs(entry.adjustment), batchId: randomUUID(), note: "Imported adjustment" });
      }
      // Preserve existing cash history. Link it to opening balances without reposting it.
      for (const payment of game.transactions) {
        let remaining = Math.abs(payment.amount);
        if (!remaining) continue;
        const summary = bankSummary(await tx.gameOperation.findMany({ where: { gameId: game.id } }));
        const sources = summary.dues.filter((row) => row.playerId === payment.playerId && (payment.amount < 0 ? isCharge(row.kind) : isCredit(row.kind)) && row.remaining > 0);
        const batchId = randomUUID();
        let firstId: string | undefined;
        for (const source of sources) {
          if (!remaining) break;
          const amount = Math.min(remaining, source.remaining);
          const op = await record(tx, command.groupId, { gameId: game.id, playerId: payment.playerId, kind: payment.amount < 0 ? "PAYMENT_IN" : "PAYMENT_OUT", amount, relatedId: source.id, batchId, note: "Imported existing ledger payment" }, false);
          firstId ??= op.id;
          remaining -= amount;
        }
        if (remaining) throw new BankError("Existing ledger payments exceed this game's recorded buy-ins or returns. Reconcile those amounts before enabling the bank.");
        if (firstId) await tx.transaction.update({ where: { id: payment.id }, data: { operationId: firstId } });
      }
      await tx.game.update({ where: { id: game.id }, data: { bankTracking: true, openingCash: command.openingCash ?? 0 } });
      game = await tx.game.findUniqueOrThrow({ where: { id: game.id }, include: { entries: true, bankOperations: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, transactions: true } });
    } else {
      if (!game.bankTracking) throw new BankError("Enable live bank tracking for this game first.");
      if (game.status !== "ACTIVE" && !["CLEAR", "SETTLE", "REOPEN"].includes(command.action)) throw new BankError("This game is closed. Only outstanding payments can be settled.");
      const before = bankSummary(game.bankOperations, game.chipBankSize, game.openingCash);
      const batchId = randomUUID();
      const requirePlayer = (id?: string) => {
        if (!id || !game.entries.some((entry) => entry.playerId === id)) throw new BankError("Choose a player seated in this game.");
        return id;
      };
      const amount = command.amount ?? 0;
      if (["BUY_IN", "CASH_OUT", "RECYCLE", "CLEAR", "SEAT"].includes(command.action) && (!Number.isSafeInteger(amount) || amount <= 0)) throw new BankError("Enter an amount greater than zero.");
      switch (command.action) {
        case "BUY_IN": {
          const source = await record(tx, command.groupId, { gameId: game.id, playerId: requirePlayer(command.playerId), kind: "BUY_IN", amount, rebuyCount: 1, batchId });
          if (command.paid) await clearRecord(tx, command.groupId, source, amount, batchId);
          break;
        }
        case "CASH_OUT": {
          const source = await record(tx, command.groupId, { gameId: game.id, playerId: requirePlayer(command.playerId), kind: "CASH_OUT", amount, batchId });
          if (command.paid) await clearRecord(tx, command.groupId, source, amount, batchId);
          break;
        }
        case "RECYCLE": {
          const playerId = requirePlayer(command.playerId);
          if (playerId === command.recipientId) throw new BankError("Choose a different player to receive the recycled chips.");
          if (amount > before.chipsInPlay) throw new BankError("You cannot recycle more chips than are currently in play.");
          await record(tx, command.groupId, { gameId: game.id, playerId, kind: "CHIP_RETURN", amount, batchId, note: "Chips returned without cash; the bank owes this player" });
          if (command.recipientId) {
            const source = await record(tx, command.groupId, { gameId: game.id, playerId: requirePlayer(command.recipientId), kind: "BUY_IN", amount, rebuyCount: 1, batchId, note: "Buy-in funded with recycled chips" });
            if (command.paid) await clearRecord(tx, command.groupId, source, amount, batchId);
          }
          break;
        }
        case "CLEAR": {
          const source = before.dues.find((row) => row.id === command.operationId);
          if (!source || source.remaining < amount) throw new BankError("This amount is already cleared, or exceeds the amount still due.");
          if (source.kind === "INITIAL_BUY_IN") throw new BankError("The initial buy-in is locked. Only additional buy-ins can be cleared during the game.");
          await clearRecord(tx, command.groupId, { ...source, gameId: game.id }, amount, batchId);
          break;
        }
        case "SETTLE": {
          const playerId = requirePlayer(command.playerId);
          const player = before.players.find((row) => row.playerId === playerId);
          if (!player || !(player.owesBank || player.bankOwes)) throw new BankError("This player is already settled.");
          const settleable = before.dues.filter((row) => row.playerId === playerId && row.remaining > 0 && (game.status === "CLOSED" || row.kind !== "INITIAL_BUY_IN"));
          if (!settleable.length) throw new BankError("Only the locked initial buy-in remains. It is included in the final settlement after the game ends.");
          const amountIn = settleable.filter((row) => isCharge(row.kind)).reduce((sum, row) => sum + row.remaining, 0);
          const amountOut = settleable.filter((row) => isCredit(row.kind)).reduce((sum, row) => sum + row.remaining, 0);
          const offset = Math.min(amountIn, amountOut);
          for (const incoming of [true, false]) {
            let creditToUse = offset;
            for (const source of settleable.filter((row) => incoming ? isCharge(row.kind) : isCredit(row.kind))) {
              const used = Math.min(source.remaining, creditToUse);
              if (used) await clearRecord(tx, command.groupId, { ...source, gameId: game.id }, used, batchId, true);
              if (source.remaining > used) await clearRecord(tx, command.groupId, { ...source, gameId: game.id }, source.remaining - used, batchId);
              creditToUse -= used;
            }
          }
          break;
        }
        case "UNDO": {
          const batch = game.bankOperations.filter((row) => row.batchId === command.batchId && !row.voidedAt);
          if (!batch.length) throw new BankError("That action has already been corrected.");
          if (batch.some((row) => row.kind === "INITIAL_BUY_IN")) throw new BankError("The initial buy-in is locked and cannot be removed.");
          const ids = batch.map((row) => row.id);
          if (game.bankOperations.some((row) => !row.voidedAt && row.relatedId && ids.includes(row.relatedId) && row.batchId !== command.batchId)) throw new BankError("Correct the linked payment first, then correct this buy-in or return.");
          await tx.transaction.deleteMany({ where: { gameId: game.id, operationId: { in: ids } } });
          await tx.gameOperation.updateMany({ where: { id: { in: ids } }, data: { voidedAt: new Date() } });
          break;
        }
        case "CHIPS":
          if (command.chipBankSize !== null && (!Number.isSafeInteger(command.chipBankSize) || command.chipBankSize! < before.chipsInPlay)) throw new BankError("The chip supply cannot be less than the chips currently at the table.");
          await tx.game.update({ where: { id: game.id }, data: { chipBankSize: command.chipBankSize } });
          break;
        case "CLOSE":
          if (before.chipsInPlay !== 0) throw new BankError("Record every remaining chip stack as a cash-out before ending the game. Money owed can be settled later.");
          await tx.game.update({ where: { id: game.id }, data: { status: "CLOSED" } });
          break;
        case "REOPEN":
          await tx.game.update({ where: { id: game.id }, data: { status: "ACTIVE" } });
          break;
        case "SEAT": {
          let player = command.playerId ? await tx.player.findUnique({ where: { id: command.playerId } }) : null;
          if (command.playerId && !player) throw new BankError("That saved player no longer exists.");
          if (!player) {
            const name = command.playerName?.trim();
            if (!name || name.length > 80) throw new BankError("Enter a player name of up to 80 characters.");
            player = (await tx.player.findMany()).find((row) => row.name.toLowerCase() === name.toLowerCase()) ?? await tx.player.create({ data: { name } });
          }
          if (game.entries.some((entry) => entry.playerId === player.id)) throw new BankError("This player is already seated. Use Buy-in to add more chips.");
          await tx.groupMember.upsert({ where: { groupId_playerId: { groupId: command.groupId, playerId: player.id } }, create: { groupId: command.groupId, playerId: player.id }, update: { active: true } });
          await tx.gameEntry.create({ data: { gameId: game.id, playerId: player.id } });
          const source = await record(tx, command.groupId, { gameId: game.id, playerId: player.id, kind: "INITIAL_BUY_IN", amount, batchId });
          if (command.paid) await clearRecord(tx, command.groupId, source, amount, batchId);
          break;
        }
      }
    }
    const fresh = await tx.game.findUniqueOrThrow({ where: { id: game.id }, include: { bankOperations: true, entries: true } });
    const summary = bankSummary(fresh.bankOperations, fresh.chipBankSize, fresh.openingCash);
    assertBankBalanced(summary);
    for (const entry of fresh.entries) {
      const player = summary.players.find((row) => row.playerId === entry.playerId);
      await tx.gameEntry.update({ where: { id: entry.id }, data: { buyIn: player?.buyIn ?? 0, cashOut: player?.cashOut ?? 0, adjustment: player?.adjustment ?? 0, rebuys: player?.rebuys ?? 0 } });
    }
    return { gameId: game.id, version: fresh.bankVersion };
  }, { timeout: 20_000 });
}
