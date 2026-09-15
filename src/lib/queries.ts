import { cache } from "react";
import { prisma } from "@/lib/db";
import { getActiveGroupId } from "@/lib/groups";
import {
  aggregatePlayers,
  buildNights,
  flattenRows,
  leagueRecords,
  leagueSummary,
  type NightSummary,
  type PlayerAggregate,
  type RawEntry,
} from "@/lib/metrics";

export type Scope = "all" | number;

async function loadEntries(groupId: string): Promise<RawEntry[]> {
  const entries = await prisma.gameEntry.findMany({
    where: { game: { groupId } },
    include: {
      game: { select: { id: true, name: true, date: true, status: true } },
      player: { select: { id: true, name: true } },
    },
  });

  return entries.map((e) => ({
    gameId: e.game.id,
    gameName: e.game.name,
    date: e.game.date,
    status: e.game.status,
    playerId: e.player.id,
    playerName: e.player.name,
    buyIn: e.buyIn,
    cashOut: e.cashOut,
    rebuys: e.rebuys,
    adjustment: e.adjustment,
  }));
}

export const getAllNights = cache(async (groupId: string): Promise<NightSummary[]> => {
  return buildNights(await loadEntries(groupId));
});

export function filterByScope(nights: NightSummary[], scope: Scope): NightSummary[] {
  if (scope === "all") return nights;
  return nights.filter((n) => n.date.getFullYear() === scope);
}

export function onlyClosed(nights: NightSummary[]): NightSummary[] {
  return nights.filter((n) => n.status === "CLOSED");
}

export type LeagueView = {
  nights: NightSummary[];
  closedNights: NightSummary[];
  players: PlayerAggregate[];
  summary: ReturnType<typeof leagueSummary>;
  records: ReturnType<typeof leagueRecords>;
  seasons: number[];
};

/**
 * The single entry point for every read-only page. `scope` narrows to one
 * calendar year; ranked stats always ignore nights that are still open, so an
 * in-progress game never pollutes the leaderboard.
 */
export const getLeagueView = cache(async (scope: Scope = "all"): Promise<LeagueView> => {
  const groupId = await getActiveGroupId();
  const all = await getAllNights(groupId);
  const seasons = [...new Set(all.map((n) => n.date.getFullYear()))].sort((a, b) => b - a);
  const scoped = filterByScope(all, scope);
  const closed = onlyClosed(scoped);
  const players = aggregatePlayers(flattenRows(closed));

  return {
    nights: scoped,
    closedNights: closed,
    players,
    summary: leagueSummary(closed, players),
    records: leagueRecords(closed, players),
    seasons,
  };
});

export const getPlayers = cache(async () => {
  const groupId = await getActiveGroupId();
  const memberships = await prisma.groupMember.findMany({
    where: { groupId },
    include: { player: true },
    orderBy: { player: { name: "asc" } },
  });
  return memberships.map(({ player, active }) => ({ ...player, active }));
});

export const getPlayer = cache(async (id: string) => {
  const groupId = await getActiveGroupId();
  const player = await prisma.player.findFirst({
    where: {
      id,
      OR: [
        { groups: { some: { groupId } } },
        { entries: { some: { game: { groupId } } } },
      ],
    },
    include: { groups: { where: { groupId }, select: { active: true } } },
  });
  if (!player) return null;
  const { groups, ...data } = player;
  return { ...data, active: groups[0]?.active ?? false };
});

export const getGame = cache(async (id: string) => {
  const groupId = await getActiveGroupId();
  return prisma.game.findFirst({
    where: { id, groupId },
    include: {
      entries: { include: { player: true } },
      bankOperations: { include: { player: { select: { name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  });
});

export const getGames = cache(async () => {
  const groupId = await getActiveGroupId();
  return prisma.game.findMany({
    where: { groupId },
    orderBy: { date: "desc" },
    include: { entries: { include: { player: { select: { id: true, name: true } } } }, bankOperations: true },
  });
});

export function parseScope(value: string | undefined | null): Scope {
  if (!value || value === "all") return "all";
  const n = Number(value);
  return Number.isFinite(n) ? n : "all";
}
