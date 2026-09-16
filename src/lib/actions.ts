"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { getActiveGroupId, playerBelongsToGroup } from "@/lib/groups";
import { isTxType, signedAmount, type TxType } from "@/lib/ledger-types";
import { toCents } from "@/lib/money";

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optional(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ players */

export async function createPlayer(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const name = str(fd, "name");
  if (!name) return { error: "Name is required." };

  const existing = await prisma.player.findUnique({ where: { name } });
  if (existing) {
    if (await playerBelongsToGroup(existing.id, groupId)) {
      return { error: `A player called "${name}" is already in this group.` };
    }
    await prisma.groupMember.create({
      data: {
        groupId,
        playerId: existing.id,
        role: "MEMBER",
        active: fd.get("active") !== null,
      },
    });
    refreshAll();
    return { ok: true as const, message: `${name} added to this group.` };
  }

  await prisma.player.create({
    data: {
      name,
      nickname: optional(fd, "nickname"),
      email: optional(fd, "email"),
      phone: optional(fd, "phone"),
      notes: optional(fd, "notes"),
      active: fd.get("active") !== null,
      groups: {
        create: {
          groupId,
          role: "MEMBER",
          active: fd.get("active") !== null,
        },
      },
    },
  });

  refreshAll();
  return { ok: true as const, message: `${name} added.` };
}

export async function updatePlayer(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (!id) return { error: "Missing player." };
  if (!name) return { error: "Name is required." };
  if (!(await playerBelongsToGroup(id, groupId))) return { error: "Player is not in this group." };

  const clash = await prisma.player.findFirst({ where: { name, NOT: { id } } });
  if (clash) return { error: `A player called "${name}" already exists.` };

  const active = fd.get("active") !== null;
  await prisma.$transaction([
    prisma.player.update({
      where: { id },
      data: {
        name,
        nickname: optional(fd, "nickname"),
        email: optional(fd, "email"),
        phone: optional(fd, "phone"),
        notes: optional(fd, "notes"),
      },
    }),
    prisma.groupMember.update({
      where: { groupId_playerId: { groupId, playerId: id } },
      data: { active },
    }),
  ]);

  refreshAll();
  return { ok: true as const, message: "Saved." };
}

export async function deletePlayer(fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  if (!id) return;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_playerId: { groupId, playerId: id } },
  });
  if (!membership || membership.role === "OWNER") return;
  await prisma.groupMember.delete({ where: { groupId_playerId: { groupId, playerId: id } } });
  refreshAll();
  redirect("/players");
}

/* -------------------------------------------------------------------- games */

export async function createGame(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const name = str(fd, "name");
  const date = parseDateInput(str(fd, "date"));
  if (!name) return { error: "Give the night a name." };

  const defaultBuyIn = toCents(str(fd, "defaultBuyIn") || "20");
  const requestedPlayerIds = fd.getAll("playerIds").filter((v): v is string => typeof v === "string");
  const memberships = await prisma.groupMember.findMany({
    where: { groupId, playerId: { in: requestedPlayerIds } },
    select: { playerId: true },
  });
  const playerIds = memberships.map((membership) => membership.playerId);

  const game = await prisma.game.create({
    data: {
      groupId,
      name,
      date,
      location: optional(fd, "location"),
      notes: optional(fd, "notes"),
      defaultBuyIn,
      status: "ACTIVE",
      entries: {
        create: playerIds.map((playerId) => ({ playerId, buyIn: defaultBuyIn, cashOut: 0 })),
      },
    },
  });

  refreshAll();
  redirect(`/games/${game.id}`);
}

export async function updateGame(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  if (!id) return { error: "Missing game." };
  const name = str(fd, "name");
  if (!name) return { error: "Give the night a name." };

  const game = await prisma.game.findFirst({ where: { id, groupId }, select: { id: true } });
  if (!game) return { error: "Night is not in this group." };

  await prisma.game.update({
    where: { id },
    data: {
      name,
      date: parseDateInput(str(fd, "date")),
      location: optional(fd, "location"),
      notes: optional(fd, "notes"),
      defaultBuyIn: toCents(str(fd, "defaultBuyIn") || "20"),
    },
  });

  refreshAll();
  return { ok: true as const, message: "Night updated." };
}

export async function deleteGame(fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  if (!id) return;
  const game = await prisma.game.findFirst({ where: { id, groupId }, select: { id: true } });
  if (!game) return;
  await prisma.game.delete({ where: { id } });
  refreshAll();
  redirect("/games");
}

export async function setGameStatus(fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || (status !== "ACTIVE" && status !== "CLOSED")) return;
  const game = await prisma.game.findFirst({ where: { id, groupId } });
  if (!game || game.bankTracking) return;
  await prisma.game.update({ where: { id }, data: { status } });
  refreshAll();
}

export async function addPlayersToGame(fd: FormData) {
  const groupId = await getActiveGroupId();
  const gameId = str(fd, "gameId");
  if (!gameId) return;
  const game = await prisma.game.findFirst({ where: { id: gameId, groupId } });
  if (!game || game.bankTracking || game.status !== "ACTIVE") return;

  const playerIds = fd.getAll("playerIds").filter((v): v is string => typeof v === "string");
  for (const playerId of playerIds) {
    if (!(await playerBelongsToGroup(playerId, groupId))) continue;
    await prisma.gameEntry.upsert({
      where: { gameId_playerId: { gameId, playerId } },
      create: { gameId, playerId, buyIn: game.defaultBuyIn, cashOut: 0 },
      update: {},
    });
  }

  refreshAll();
}

export async function removeEntry(fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  if (!id) return;
  const entry = await prisma.gameEntry.findFirst({
    where: { id, game: { groupId } },
    select: { id: true, game: { select: { bankTracking: true, status: true } } },
  });
  if (!entry || entry.game.bankTracking || entry.game.status !== "ACTIVE") return;
  await prisma.gameEntry.delete({ where: { id } });
  refreshAll();
}

/**
 * Bulk-save the results grid. Every row arrives as `buyIn:<entryId>` etc, so one
 * submit rewrites the whole night atomically instead of row-by-row round trips.
 */
export async function saveEntries(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const gameId = str(fd, "gameId");
  if (!gameId) return { error: "Missing game." };

  const game = await prisma.game.findFirst({ where: { id: gameId, groupId } });
  if (!game || game.status !== "ACTIVE") return { error: "This game is closed or unavailable." };
  if (game.bankTracking) return { error: "Use the live bank controls to keep chips, buy-ins and payments in sync." };

  const entries = await prisma.gameEntry.findMany({ where: { gameId, game: { groupId } } });
  if (entries.length === 0) return { error: "Night is not in this group or has no entries." };
  const updates = entries.map((e) => {
    const buyIn = toCents(str(fd, `buyIn:${e.id}`));
    const cashOut = toCents(str(fd, `cashOut:${e.id}`));
    const rebuys = Number(str(fd, `rebuys:${e.id}`) || 0);
    const adjustment = toCents(str(fd, `adjustment:${e.id}`));
    return prisma.gameEntry.update({
      where: { id: e.id },
      data: {
        buyIn,
        cashOut,
        rebuys: Number.isFinite(rebuys) ? Math.max(0, Math.trunc(rebuys)) : 0,
        adjustment,
        note: optional(fd, `note:${e.id}`),
      },
    });
  });

  await prisma.$transaction(updates);
  refreshAll();
  return { ok: true as const, message: "Amounts saved." };
}

/**
 * Mirror a night's buy-ins and cash-outs into the transaction ledger.
 * Idempotent: existing ledger rows for this game are replaced, so running it
 * twice never double-counts.
 */
export async function postGameToLedger(fd: FormData) {
  const groupId = await getActiveGroupId();
  const gameId = str(fd, "gameId");
  if (!gameId) return;

  const game = await prisma.game.findFirst({
    where: { id: gameId, groupId },
    include: { entries: true },
  });
  if (!game || game.bankTracking) return;

  await prisma.transaction.deleteMany({ where: { gameId, groupId } });

  const rows = game.entries.flatMap((e) => {
    const out: {
      playerId: string;
      date: Date;
      type: TxType;
      amount: number;
      note: string;
      gameId: string;
      groupId: string;
    }[] = [];
    if (e.buyIn > 0)
      out.push({
        playerId: e.playerId,
        date: game.date,
        type: "BUY_IN",
        amount: -e.buyIn,
        note: game.name,
        gameId,
        groupId,
      });
    if (e.cashOut > 0)
      out.push({
        playerId: e.playerId,
        date: game.date,
        type: "CASH_OUT",
        amount: e.cashOut,
        note: game.name,
        gameId,
        groupId,
      });
    if (e.adjustment !== 0)
      out.push({
        playerId: e.playerId,
        date: game.date,
        type: "ADJUSTMENT",
        amount: e.adjustment,
        note: `${game.name} adjustment`,
        gameId,
        groupId,
      });
    return out;
  });

  if (rows.length) await prisma.transaction.createMany({ data: rows });
  refreshAll();
}

/* ------------------------------------------------------------- transactions */

export async function createTransaction(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const playerId = str(fd, "playerId");
  const typeRaw = str(fd, "type");
  const amountRaw = str(fd, "amount");
  const gameId = optional(fd, "gameId");

  if (!playerId) return { error: "Pick a player." };
  if (!isTxType(typeRaw)) return { error: "Pick a transaction type." };
  if (!amountRaw) return { error: "Enter an amount." };
  if (!(await playerBelongsToGroup(playerId, groupId))) {
    return { error: "That player is not in the active group." };
  }
  if (gameId) {
    const game = await prisma.game.findFirst({ where: { id: gameId, groupId }, select: { id: true, bankTracking: true } });
    if (!game) return { error: "That night is not in the active group." };
    if (game.bankTracking) return { error: "Record this payment from the game's bank controls so it clears the matching buy-in or cash-out." };
  }

  const magnitude = toCents(amountRaw);
  if (magnitude === 0) return { error: "Amount cannot be zero." };

  const sign = str(fd, "sign") === "-1" ? -1 : 1;
  const amount = signedAmount(typeRaw, magnitude, sign);

  await prisma.transaction.create({
    data: {
      groupId,
      playerId,
      date: parseDateInput(str(fd, "date")),
      type: typeRaw,
      amount,
      method: optional(fd, "method"),
      note: optional(fd, "note"),
      gameId,
    },
  });

  refreshAll();
  return { ok: true as const, message: "Transaction recorded." };
}

/**
 * Record one settle-up payment between two players as a linked pair of ledger
 * entries: the payer hands cash in, the receiver takes cash out. Written in one
 * transaction so a half-recorded payment can never skew the balances.
 */
export async function recordSettlement(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const fromId = str(fd, "fromId");
  const toId = str(fd, "toId");
  const amount = toCents(str(fd, "amount"));

  if (!fromId || !toId) return { error: "Pick who is paying and who is being paid." };
  if (fromId === toId) return { error: "A player cannot pay themselves." };
  if (amount <= 0) return { error: "Enter an amount above zero." };
  if (!(await playerBelongsToGroup(fromId, groupId)) || !(await playerBelongsToGroup(toId, groupId))) {
    return { error: "Those players are not in the active group." };
  }

  const [payer, receiver] = await Promise.all([
    prisma.player.findUnique({ where: { id: fromId }, select: { name: true } }),
    prisma.player.findUnique({ where: { id: toId }, select: { name: true } }),
  ]);
  if (!payer || !receiver) return { error: "Player not found." };

  const date = parseDateInput(str(fd, "date"));
  const method = optional(fd, "method");

  await prisma.$transaction([
    prisma.transaction.create({
      data: { groupId, playerId: fromId, date, type: "PAYMENT_IN", amount: -amount, method, note: `Settle up: paid ${receiver.name}` },
    }),
    prisma.transaction.create({
      data: { groupId, playerId: toId, date, type: "PAYMENT_OUT", amount, method, note: `Settle up: paid by ${payer.name}` },
    }),
  ]);

  refreshAll();
  return { ok: true as const, message: `Recorded ${payer.name} → ${receiver.name}.` };
}

export async function updateTransaction(_prev: unknown, fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  const typeRaw = str(fd, "type");
  if (!id) return { error: "Missing transaction." };
  if (!isTxType(typeRaw)) return { error: "Pick a transaction type." };
  const transaction = await prisma.transaction.findFirst({
    where: { id, groupId },
    select: { id: true, operationId: true },
  });
  if (!transaction) return { error: "Transaction is not in this group." };
  if (transaction.operationId) return { error: "This payment is linked to a live game. Correct it from the game's activity history." };
  const playerId = str(fd, "playerId");
  if (!(await playerBelongsToGroup(playerId, groupId))) {
    return { error: "That player is not in the active group." };
  }

  const magnitude = toCents(str(fd, "amount"));
  if (magnitude === 0) return { error: "Amount cannot be zero." };
  const sign = str(fd, "sign") === "-1" ? -1 : 1;

  await prisma.transaction.update({
    where: { id },
    data: {
      playerId,
      date: parseDateInput(str(fd, "date")),
      type: typeRaw,
      amount: signedAmount(typeRaw, magnitude, sign),
      method: optional(fd, "method"),
      note: optional(fd, "note"),
    },
  });

  refreshAll();
  return { ok: true as const, message: "Transaction updated." };
}

export async function deleteTransaction(fd: FormData) {
  const groupId = await getActiveGroupId();
  const id = str(fd, "id");
  if (!id) return;
  const transaction = await prisma.transaction.findFirst({ where: { id, groupId }, select: { id: true, operationId: true } });
  if (!transaction || transaction.operationId) return;
  await prisma.transaction.delete({ where: { id } });
  refreshAll();
  const to = str(fd, "redirectTo");
  if (to) redirect(to);
}
