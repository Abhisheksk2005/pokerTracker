import { cache } from "react";
import { prisma } from "@/lib/db";
import { getActiveGroupId } from "@/lib/groups";

/**
 * The transaction ledger sits alongside game results and answers a different
 * question: not "how did the night go" but "who has actually handed over money,
 * and when". Shared vocabulary lives in ledger-types so client components can
 * import it without pulling the database in.
 */

export * from "@/lib/ledger-types";
import type { TxType } from "@/lib/ledger-types";

export type LedgerFilters = {
  playerId?: string;
  from?: Date;
  to?: Date;
  type?: TxType;
  gameId?: string;
};

export const getTransactions = cache(async (filters: LedgerFilters = {}) => {
  const groupId = await getActiveGroupId();
  return prisma.transaction.findMany({
    where: {
      groupId,
      ...(filters.playerId ? { playerId: filters.playerId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.gameId ? { gameId: filters.gameId } : {}),
      ...(filters.from || filters.to
        ? {
            date: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      player: { select: { id: true, name: true } },
      game: { select: { id: true, name: true } },
    },
  });
});

export const getTransaction = cache(async (id: string) => {
  const groupId = await getActiveGroupId();
  return prisma.transaction.findFirst({
    where: { id, groupId },
    include: { game: true },
  });
});

export type TxRow = Awaited<ReturnType<typeof getTransactions>>[number];

export type DayGroup = {
  key: string;
  date: Date;
  rows: TxRow[];
  moneyIn: number; // cash collected from players
  moneyOut: number; // cash paid to players
  net: number;
};

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group a ledger into calendar days, newest first. */
export function groupByDay(rows: TxRow[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const r of rows) {
    const key = dayKey(r.date);
    let g = map.get(key);
    if (!g) {
      g = { key, date: r.date, rows: [], moneyIn: 0, moneyOut: 0, net: 0 };
      map.set(key, g);
    }
    g.rows.push(r);
    if (r.amount < 0) g.moneyIn += -r.amount;
    else g.moneyOut += r.amount;
    g.net += r.amount;
  }
  return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** Oldest-first rows with a running balance attached, for a single player. */
export function withRunningBalance(rows: TxRow[]) {
  const chrono = [...rows].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    return d !== 0 ? d : a.createdAt.getTime() - b.createdAt.getTime();
  });
  let balance = 0;
  return chrono.map((r) => {
    balance += r.amount;
    return { ...r, balance };
  });
}

export type PlayerBalance = {
  playerId: string;
  playerName: string;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  txCount: number;
  lastDate: Date | null;
};

export function balancesByPlayer(rows: TxRow[]): PlayerBalance[] {
  const map = new Map<string, PlayerBalance>();
  for (const r of rows) {
    let b = map.get(r.playerId);
    if (!b) {
      b = {
        playerId: r.playerId,
        playerName: r.player.name,
        moneyIn: 0,
        moneyOut: 0,
        balance: 0,
        txCount: 0,
        lastDate: null,
      };
      map.set(r.playerId, b);
    }
    if (r.amount < 0) b.moneyIn += -r.amount;
    else b.moneyOut += r.amount;
    b.balance += r.amount;
    b.txCount += 1;
    if (!b.lastDate || r.date > b.lastDate) b.lastDate = r.date;
  }
  return [...map.values()].sort((a, b) => a.playerName.localeCompare(b.playerName));
}

export function ledgerTotals(rows: TxRow[]) {
  let moneyIn = 0;
  let moneyOut = 0;
  for (const r of rows) {
    if (r.amount < 0) moneyIn += -r.amount;
    else moneyOut += r.amount;
  }
  return { moneyIn, moneyOut, net: moneyOut - moneyIn, count: rows.length };
}
