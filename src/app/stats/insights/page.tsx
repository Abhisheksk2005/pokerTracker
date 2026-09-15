import { Card, CardHeader, Empty, PlayerLink } from "@/components/ui";
import {
  competitivenessLabel,
  formWindow,
  HEATER_MAX_BUYIN_CENTS,
  HEATER_ROI,
  skillRatings,
} from "@/lib/metrics";
import { fmtMoney, fmtPct } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StatsInsights({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const view = await getLeagueView(parseScope(sp.scope));
  const { closedNights, players, summary } = view;

  if (closedNights.length === 0) {
    return (
      <Card>
        <Empty>No finished nights in this scope.</Empty>
      </Card>
    );
  }

  const ratings = skillRatings(closedNights);
  const hot = formWindow(closedNights, 10);
  const heaters = [...players]
    .filter((p) => p.heaterNights > 0)
    .sort((a, b) => b.heaterNights - a.heaterNights);

  const eligible = players.filter((p) => p.eligible);
  const bestRoi = eligible.length
    ? eligible.reduce((b, p) => ((p.roi ?? -Infinity) > (b.roi ?? -Infinity) ? p : b))
    : null;
  const bestScore = eligible.length
    ? eligible.reduce((b, p) => ((p.score ?? -Infinity) > (b.score ?? -Infinity) ? p : b))
    : null;

  const half = Math.ceil(closedNights.length / 2);
  const recentAvg = avgPot(closedNights.slice(0, half));
  const olderAvg = avgPot(closedNights.slice(half));
  const potTrend =
    olderAvg === 0
      ? "flat"
      : recentAvg > olderAvg * 1.05
        ? "up"
        : recentAvg < olderAvg * 0.95
          ? "down"
          : "flat";

  return (
    <div className="flex flex-col gap-5">
      <Card className="violet-panel">
        <CardHeader title="League narrative" subtitle="Auto-generated from the current scope" />
        <p className="px-4 py-4 text-sm leading-relaxed">
          Leading by profit:{" "}
          {players[0] ? (
            <PlayerLink id={players[0].playerId} name={players[0].playerName} />
          ) : (
            "nobody"
          )}
          . Best ROI:{" "}
          {bestRoi ? <PlayerLink id={bestRoi.playerId} name={bestRoi.playerName} /> : "—"} (
          {fmtPct(bestRoi?.roi ?? null)}). Best performer by score:{" "}
          {bestScore ? <PlayerLink id={bestScore.playerId} name={bestScore.playerName} /> : "—"}.
          Hottest recently:{" "}
          {hot[0] ? <PlayerLink id={hot[0].playerId} name={hot[0].playerName} /> : "—"}. Pot trend:{" "}
          <strong>{potTrend}</strong> ({fmtMoney(olderAvg)} → {fmtMoney(recentAvg)} average).{" "}
          {competitivenessLabel(summary.topShareOfPositive)} field — {summary.uniquePlayers} unique
          players across {summary.totalNights} nights, averaging{" "}
          {summary.avgPlayersPerNight.toFixed(2)} per night.
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Skill rating"
            subtitle="Elo-style, from nightly finishing position. Everyone starts at 1500; computed on read, never stored."
            action={<span className="chip chip-accent">Experimental</span>}
          />
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Player</th>
                  <th className="num">Rating</th>
                  <th className="num">Last 5</th>
                  <th className="num">Nights</th>
                </tr>
              </thead>
              <tbody>
                {ratings.map((r, i) => (
                  <tr key={r.playerId}>
                    <td className="num text-[var(--text-faint)]">{i + 1}</td>
                    <td>
                      <PlayerLink id={r.playerId} name={r.playerName} />
                    </td>
                    <td className="num font-semibold">{r.rating}</td>
                    <td
                      className={`num ${
                        r.change > 0
                          ? "text-[var(--up)]"
                          : r.change < 0
                            ? "text-[var(--down)]"
                            : "text-[var(--text-faint)]"
                      }`}
                    >
                      {r.change > 0 ? "+" : ""}
                      {r.change}
                    </td>
                    <td className="num text-[var(--text-dim)]">{r.nights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Heater index"
              subtitle={`Nights with ROI above ${fmtPct(HEATER_ROI, 0)} on a buy-in of ${fmtMoney(
                HEATER_MAX_BUYIN_CENTS,
              )} or less`}
            />
            {heaters.length === 0 ? (
              <Empty>Nobody has run hot on a short stack yet.</Empty>
            ) : (
              <div className="scroll-x">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th className="num">Heater nights</th>
                      <th className="num">Of</th>
                      <th className="num">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heaters.map((p) => (
                      <tr key={p.playerId}>
                        <td>
                          <PlayerLink id={p.playerId} name={p.playerName} />
                        </td>
                        <td className="num font-semibold">{p.heaterNights}</td>
                        <td className="num text-[var(--text-dim)]">{p.nights}</td>
                        <td className="num">{fmtPct(p.heaterNights / p.nights)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Form guide" subtitle="Last 10 nights only" />
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="num">Profit</th>
                    <th className="num">ROI</th>
                    <th className="num">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {hot.slice(0, 10).map((p) => (
                    <tr key={p.playerId}>
                      <td>
                        <PlayerLink id={p.playerId} name={p.playerName} />
                      </td>
                      <td
                        className={`num ${
                          p.profit > 0
                            ? "text-[var(--up)]"
                            : p.profit < 0
                              ? "text-[var(--down)]"
                              : ""
                        }`}
                      >
                        {fmtMoney(p.profit, { sign: true })}
                      </td>
                      <td className="num">{fmtPct(p.roi)}</td>
                      <td className="num">
                        {p.currentStreak.type
                          ? `${p.currentStreak.length}${p.currentStreak.type}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function avgPot(nights: { pot: number }[]) {
  if (nights.length === 0) return 0;
  return Math.round(nights.reduce((s, n) => s + n.pot, 0) / nights.length);
}
