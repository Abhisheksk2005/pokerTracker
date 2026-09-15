/**
 * Every derived number in the app is computed here, from raw entries.
 * Nothing is stored pre-aggregated, so editing a night immediately corrects
 * every leaderboard, streak and rating that depends on it.
 *
 * Formula reference (all buy-in figures in DOLLARS inside the formulas):
 *   profit          = cashOut - buyIn + adjustment
 *   roi             = profit / buyIn
 *   nightScore      = roi * sqrt(buyIn)          "how well you played the money you risked"
 *   potShare        = buyIn / pot                exposure: how much of the night was yours
 *   tableShare      = profit / pot               how much of the night you took home
 *   potWeightedScore= nightScore * (pot / 100)   comparable across nights of different size
 * Aggregates reuse the same shapes on summed buy-ins and summed profit.
 */

export const MIN_NIGHTS_FOR_ELIGIBILITY = 3;
export const HEATER_ROI = 0.5;
export const HEATER_MAX_BUYIN_CENTS = 2000;
export const PODIUM_POINTS = [3, 2, 1];

export type RawEntry = {
  gameId: string;
  gameName: string;
  date: Date;
  status: string;
  playerId: string;
  playerName: string;
  buyIn: number; // cents
  cashOut: number; // cents
  rebuys: number;
  adjustment: number; // cents
};

export type NightRow = RawEntry & {
  profit: number; // cents
  roi: number | null;
  nightScore: number | null;
  pot: number; // cents
  potShare: number | null;
  tableShare: number | null;
  potWeightedScore: number | null;
  place: number;
  playerCount: number;
};

export type NightSummary = {
  gameId: string;
  name: string;
  date: Date;
  status: string;
  pot: number;
  totalOut: number;
  bankDelta: number;
  playerCount: number;
  rebuys: number;
  rows: NightRow[];
  winner: NightRow | null;
  loser: NightRow | null;
};

export function entryProfit(e: Pick<RawEntry, "buyIn" | "cashOut" | "adjustment">): number {
  return e.cashOut - e.buyIn + e.adjustment;
}

export function roiOf(profitCents: number, buyInCents: number): number | null {
  if (buyInCents <= 0) return null;
  return profitCents / buyInCents;
}

export function scoreOf(roi: number | null, buyInCents: number): number | null {
  if (roi === null || buyInCents <= 0) return null;
  return roi * Math.sqrt(buyInCents / 100);
}

/** Group raw entries into per-night summaries, sorted newest first. */
export function buildNights(entries: RawEntry[]): NightSummary[] {
  const byGame = new Map<string, RawEntry[]>();
  for (const e of entries) {
    const list = byGame.get(e.gameId);
    if (list) list.push(e);
    else byGame.set(e.gameId, [e]);
  }

  const nights: NightSummary[] = [];
  for (const [gameId, list] of byGame) {
    const pot = list.reduce((s, e) => s + e.buyIn, 0);
    const totalOut = list.reduce((s, e) => s + e.cashOut, 0);
    const ranked = [...list].sort((a, b) => entryProfit(b) - entryProfit(a));

    const rows: NightRow[] = ranked.map((e, i) => {
      const profit = entryProfit(e);
      const roi = roiOf(profit, e.buyIn);
      const nightScore = scoreOf(roi, e.buyIn);
      return {
        ...e,
        profit,
        roi,
        nightScore,
        pot,
        potShare: pot > 0 ? e.buyIn / pot : null,
        tableShare: pot > 0 ? profit / pot : null,
        potWeightedScore: nightScore === null ? null : nightScore * (pot / 100 / 100),
        place: i + 1,
        playerCount: list.length,
      };
    });

    const first = list[0];
    nights.push({
      gameId,
      name: first.gameName,
      date: first.date,
      status: first.status,
      pot,
      totalOut,
      bankDelta: pot - totalOut,
      playerCount: list.length,
      rebuys: list.reduce((s, e) => s + e.rebuys, 0),
      rows,
      winner: rows.length ? rows[0] : null,
      loser: rows.length ? rows[rows.length - 1] : null,
    });
  }

  nights.sort((a, b) => b.date.getTime() - a.date.getTime());
  return nights;
}

/** Flatten nights back to rows that carry place + pot context. */
export function flattenRows(nights: NightSummary[]): NightRow[] {
  return nights.flatMap((n) => n.rows);
}

export type PlayerAggregate = {
  playerId: string;
  playerName: string;
  nights: number;
  buyIn: number;
  cashOut: number;
  profit: number;
  roi: number | null;
  score: number | null;
  won: number; // 1st places
  podiumPoints: number;
  inProfit: number;
  winRate: number | null; // nights won / nights
  profitRate: number | null; // nights in profit / nights
  avgPotShare: number | null;
  bestNight: NightRow | null;
  worstNight: NightRow | null;
  rebuys: number;
  heaterNights: number;
  currentStreak: { type: "W" | "L" | null; length: number };
  longestWinStreak: number;
  longestLossStreak: number;
  eligible: boolean;
  rows: NightRow[]; // oldest -> newest
};

export function aggregatePlayers(rows: NightRow[]): PlayerAggregate[] {
  const byPlayer = new Map<string, NightRow[]>();
  for (const r of rows) {
    const list = byPlayer.get(r.playerId);
    if (list) list.push(r);
    else byPlayer.set(r.playerId, [r]);
  }

  const out: PlayerAggregate[] = [];
  for (const [playerId, list] of byPlayer) {
    const chrono = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    const buyIn = chrono.reduce((s, r) => s + r.buyIn, 0);
    const cashOut = chrono.reduce((s, r) => s + r.cashOut, 0);
    const profit = chrono.reduce((s, r) => s + r.profit, 0);
    const roi = roiOf(profit, buyIn);

    let best: NightRow | null = null;
    let worst: NightRow | null = null;
    let podiumPoints = 0;
    let won = 0;
    let inProfit = 0;
    let heaterNights = 0;
    let potShareSum = 0;
    let potShareCount = 0;

    for (const r of chrono) {
      if (!best || r.profit > best.profit) best = r;
      if (!worst || r.profit < worst.profit) worst = r;
      if (r.place === 1) won += 1;
      if (r.place <= PODIUM_POINTS.length) podiumPoints += PODIUM_POINTS[r.place - 1];
      if (r.profit > 0) inProfit += 1;
      if (r.roi !== null && r.roi > HEATER_ROI && r.buyIn <= HEATER_MAX_BUYIN_CENTS) heaterNights += 1;
      if (r.potShare !== null) {
        potShareSum += r.potShare;
        potShareCount += 1;
      }
    }

    const streaks = computeStreaks(chrono);

    out.push({
      playerId,
      playerName: chrono[0].playerName,
      nights: chrono.length,
      buyIn,
      cashOut,
      profit,
      roi,
      score: scoreOf(roi, buyIn),
      won,
      podiumPoints,
      inProfit,
      winRate: chrono.length ? won / chrono.length : null,
      profitRate: chrono.length ? inProfit / chrono.length : null,
      avgPotShare: potShareCount ? potShareSum / potShareCount : null,
      bestNight: best,
      worstNight: worst,
      rebuys: chrono.reduce((s, r) => s + r.rebuys, 0),
      heaterNights,
      currentStreak: streaks.current,
      longestWinStreak: streaks.longestWin,
      longestLossStreak: streaks.longestLoss,
      eligible: chrono.length >= MIN_NIGHTS_FOR_ELIGIBILITY,
      rows: chrono,
    });
  }

  out.sort((a, b) => b.profit - a.profit);
  return out;
}

function computeStreaks(chrono: NightRow[]) {
  let longestWin = 0;
  let longestLoss = 0;
  let runType: "W" | "L" | null = null;
  let runLen = 0;

  for (const r of chrono) {
    const t: "W" | "L" | null = r.profit > 0 ? "W" : r.profit < 0 ? "L" : null;
    if (t === null) {
      runType = null;
      runLen = 0;
      continue;
    }
    if (t === runType) runLen += 1;
    else {
      runType = t;
      runLen = 1;
    }
    if (t === "W") longestWin = Math.max(longestWin, runLen);
    else longestLoss = Math.max(longestLoss, runLen);
  }

  return { current: { type: runType, length: runLen }, longestWin, longestLoss };
}

/** Rolling-window form: profit + ROI over the last N nights of the league. */
export function formWindow(nights: NightSummary[], windowSize: number) {
  const window = nights.slice(0, windowSize);
  const rows = window.flatMap((n) => n.rows);
  return aggregatePlayers(rows);
}

/**
 * Elo-style skill rating from nightly finishing position.
 * Everyone starts at 1500. Each night is treated as a round robin: your actual
 * score is your normalised rank, your expected score is the average logistic
 * expectation against every other player at the table. Computed on read.
 */
export function skillRatings(nights: NightSummary[], k = 16) {
  const chrono = [...nights].sort((a, b) => a.date.getTime() - b.date.getTime());
  const rating = new Map<string, number>();
  const name = new Map<string, string>();
  const history = new Map<string, number[]>();

  for (const night of chrono) {
    const players = night.rows;
    const n = players.length;
    if (n < 2) continue;

    const before = players.map((p) => {
      if (!rating.has(p.playerId)) rating.set(p.playerId, 1500);
      name.set(p.playerId, p.playerName);
      return rating.get(p.playerId)!;
    });

    const deltas = players.map((p, i) => {
      const actual = (n - p.place) / (n - 1);
      let expected = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        expected += 1 / (1 + Math.pow(10, (before[j] - before[i]) / 400));
      }
      expected /= n - 1;
      return k * (actual - expected);
    });

    players.forEach((p, i) => {
      const next = before[i] + deltas[i];
      rating.set(p.playerId, next);
      const h = history.get(p.playerId) ?? [];
      h.push(next);
      history.set(p.playerId, h);
    });
  }

  return [...rating.entries()]
    .map(([playerId, r]) => {
      const h = history.get(playerId) ?? [];
      const recent = h.length >= 2 ? h[h.length - 1] - h[Math.max(0, h.length - 6)] : 0;
      return {
        playerId,
        playerName: name.get(playerId) ?? "—",
        rating: Math.round(r),
        change: Math.round(recent),
        nights: h.length,
      };
    })
    .sort((a, b) => b.rating - a.rating);
}

export type LeagueSummary = {
  totalNights: number;
  totalPot: number;
  avgPot: number;
  avgPotLast10: number;
  largestPot: number;
  largestPotNight: NightSummary | null;
  uniquePlayers: number;
  avgPlayersPerNight: number;
  topShareOfPositive: number | null;
  activePlayersLast30: number;
};

export function leagueSummary(nights: NightSummary[], players: PlayerAggregate[]): LeagueSummary {
  const totalPot = nights.reduce((s, n) => s + n.pot, 0);
  const last10 = nights.slice(0, 10);
  const largest = nights.reduce<NightSummary | null>(
    (best, n) => (!best || n.pot > best.pot ? n : best),
    null,
  );
  const positives = players.filter((p) => p.profit > 0);
  const positiveTotal = positives.reduce((s, p) => s + p.profit, 0);
  const top = positives.length ? Math.max(...positives.map((p) => p.profit)) : 0;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPlayers = new Set(
    nights.filter((n) => n.date.getTime() >= cutoff).flatMap((n) => n.rows.map((r) => r.playerId)),
  );

  return {
    totalNights: nights.length,
    totalPot,
    avgPot: nights.length ? Math.round(totalPot / nights.length) : 0,
    avgPotLast10: last10.length
      ? Math.round(last10.reduce((s, n) => s + n.pot, 0) / last10.length)
      : 0,
    largestPot: largest?.pot ?? 0,
    largestPotNight: largest,
    uniquePlayers: players.length,
    avgPlayersPerNight: nights.length
      ? nights.reduce((s, n) => s + n.playerCount, 0) / nights.length
      : 0,
    topShareOfPositive: positiveTotal > 0 ? top / positiveTotal : null,
    activePlayersLast30: recentPlayers.size,
  };
}

export function competitivenessLabel(share: number | null): string {
  if (share === null) return "No data";
  if (share >= 0.5) return "Dominated";
  if (share >= 0.35) return "Top-heavy";
  if (share >= 0.2) return "Competitive";
  return "Wide open";
}

export function seasonOf(date: Date): number {
  return date.getFullYear();
}

export type SeasonSummary = {
  season: number;
  nights: number;
  totalPot: number;
  avgPot: number;
  players: number;
  firstDate: Date;
  lastDate: Date;
  mostProfitable: PlayerAggregate | null;
  bestRoi: PlayerAggregate | null;
};

export function seasonSummaries(nights: NightSummary[]): SeasonSummary[] {
  const bySeason = new Map<number, NightSummary[]>();
  for (const n of nights) {
    const s = seasonOf(n.date);
    const list = bySeason.get(s);
    if (list) list.push(n);
    else bySeason.set(s, [n]);
  }

  return [...bySeason.entries()]
    .map(([season, list]) => {
      const rows = flattenRows(list);
      const aggs = aggregatePlayers(rows);
      const totalPot = list.reduce((s, n) => s + n.pot, 0);
      const dates = list.map((n) => n.date.getTime());
      const eligibleForRoi = aggs.filter((a) => a.roi !== null);
      return {
        season,
        nights: list.length,
        totalPot,
        avgPot: list.length ? Math.round(totalPot / list.length) : 0,
        players: aggs.length,
        firstDate: new Date(Math.min(...dates)),
        lastDate: new Date(Math.max(...dates)),
        mostProfitable: aggs.length ? aggs[0] : null,
        bestRoi: eligibleForRoi.length
          ? eligibleForRoi.reduce((b, a) => ((a.roi ?? -Infinity) > (b.roi ?? -Infinity) ? a : b))
          : null,
      };
    })
    .sort((a, b) => b.season - a.season);
}

export type LeagueRecords = {
  biggestNightProfit: NightRow | null;
  biggestNightLoss: NightRow | null;
  largestPot: NightSummary | null;
  longestWinStreak: { player: PlayerAggregate; length: number } | null;
  longestLossStreak: { player: PlayerAggregate; length: number } | null;
  mostProfitable: PlayerAggregate | null;
};

export function leagueRecords(nights: NightSummary[], players: PlayerAggregate[]): LeagueRecords {
  const rows = flattenRows(nights);
  const best = rows.reduce<NightRow | null>((b, r) => (!b || r.profit > b.profit ? r : b), null);
  const worst = rows.reduce<NightRow | null>((b, r) => (!b || r.profit < b.profit ? r : b), null);
  const largest = nights.reduce<NightSummary | null>(
    (b, n) => (!b || n.pot > b.pot ? n : b),
    null,
  );

  const winStreak = players.reduce<{ player: PlayerAggregate; length: number } | null>(
    (b, p) => (!b || p.longestWinStreak > b.length ? { player: p, length: p.longestWinStreak } : b),
    null,
  );
  const lossStreak = players.reduce<{ player: PlayerAggregate; length: number } | null>(
    (b, p) =>
      !b || p.longestLossStreak > b.length ? { player: p, length: p.longestLossStreak } : b,
    null,
  );

  return {
    biggestNightProfit: best,
    biggestNightLoss: worst,
    largestPot: largest,
    longestWinStreak: winStreak && winStreak.length > 0 ? winStreak : null,
    longestLossStreak: lossStreak && lossStreak.length > 0 ? lossStreak : null,
    mostProfitable: players.length ? players[0] : null,
  };
}

/** Cumulative profit series for a player, oldest first. */
export function cumulativeSeries(rows: NightRow[]) {
  let running = 0;
  let runningBuyIn = 0;
  let runningProfit = 0;
  return rows.map((r) => {
    running += r.profit;
    runningBuyIn += r.buyIn;
    runningProfit += r.profit;
    return {
      date: r.date,
      label: r.gameName,
      cumulativeProfit: running,
      profit: r.profit,
      roi: runningBuyIn > 0 ? runningProfit / runningBuyIn : 0,
    };
  });
}
