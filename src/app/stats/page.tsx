import Link from "next/link";
import { BarChart } from "@/components/charts";
import {
  Card,
  CardHeader,
  Empty,
  Money,
  Pct,
  PlayerLink,
  StatTile,
} from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { competitivenessLabel, type PlayerAggregate } from "@/lib/metrics";
import { fmtMoney, fmtNum } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

const BOARDS: {
  key: string;
  label: string;
  sort: (a: PlayerAggregate, b: PlayerAggregate) => number;
  value: (p: PlayerAggregate) => React.ReactNode;
  eligibleOnly?: boolean;
}[] = [
  {
    key: "skill",
    label: "Best skill",
    sort: (a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity),
    value: (p) => fmtNum(p.score),
  },
  {
    key: "winner",
    label: "Top winner",
    sort: (a, b) => b.profit - a.profit,
    value: (p) => <Money cents={p.profit} signed />,
  },
  {
    key: "roi",
    label: "Best ROI",
    sort: (a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity),
    value: (p) => <Pct value={p.roi} />,
    eligibleOnly: true,
  },
  {
    key: "action",
    label: "Most action",
    sort: (a, b) => b.buyIn - a.buyIn,
    value: (p) => fmtMoney(p.buyIn),
  },
];

export default async function StatsOverview({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const view = await getLeagueView(scope);
  const { closedNights, players, summary, records } = view;

  return (
    <>
      <div className="stats-overview-grid mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="cards" label="Total nights" value={summary.totalNights} />
        <StatTile icon="chips" label="Total pot" value={fmtMoney(summary.totalPot)} />
        <StatTile
          icon="trend" label="Average pot"
          value={fmtMoney(summary.avgPot)}
          hint={`Last 10: ${fmtMoney(summary.avgPotLast10)}`}
        />
        <StatTile
          icon="players" label="Unique players"
          value={summary.uniquePlayers}
          hint={`Avg ${fmtNum(summary.avgPlayersPerNight)} per night`}
        />
        <StatTile icon="trend" label="Biggest win" value={records.biggestNightProfit ? fmtMoney(records.biggestNightProfit.profit, { sign: true }) : "—"} hint={records.biggestNightProfit?.playerName ?? "Still to come"} tone="up" />
        <StatTile icon="out" label="Biggest loss" value={records.biggestNightLoss ? fmtMoney(records.biggestNightLoss.profit, { sign: true }) : "—"} hint={records.biggestNightLoss?.playerName ?? "No results yet"} tone="down" />
        <StatTile icon="trophy" tone="violet" label="Largest pot" value={<span className="text-[var(--violet)]">{fmtMoney(summary.largestPot)}</span>} hint={records.largestPot?.name ?? "Still to come"} />
        <StatTile icon="flame" tone="violet" label="Win streak" value={<span className="text-[var(--violet)]">{records.longestWinStreak ? `${records.longestWinStreak.length}W` : "—"}</span>} hint={records.longestWinStreak?.player.playerName ?? "Make it yours"} />
      </div>

      {closedNights.length === 0 ? <Card className="mb-5"><Empty>Finish your first night to reveal rankings, records and league trends.</Empty></Card> : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="League summary" />
          <dl className="divide-y text-sm">
            <Row label="Largest pot" value={fmtMoney(summary.largestPot)} />
            <Row
              label="Competitiveness"
              value={`${competitivenessLabel(summary.topShareOfPositive)} · top player holds ${
                summary.topShareOfPositive === null
                  ? "—"
                  : `${Math.round(summary.topShareOfPositive * 100)}%`
              } of winnings`}
            />
            <Row label="Active players (30d)" value={String(summary.activePlayersLast30)} />
          </dl>
        </Card>

        <Card className="violet-panel">
          <CardHeader title="Records" subtitle="Within the current scope" />
          <dl className="divide-y text-sm">
            <Row
              label="Biggest single-night profit"
              value={
                records.biggestNightProfit ? (
                  <>
                    {fmtMoney(records.biggestNightProfit.profit, { sign: true })} (
                    <PlayerLink
                      id={records.biggestNightProfit.playerId}
                      name={records.biggestNightProfit.playerName}
                    />
                    )
                  </>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Biggest single-night loss"
              value={
                records.biggestNightLoss ? (
                  <>
                    {fmtMoney(records.biggestNightLoss.profit, { sign: true })} (
                    <PlayerLink
                      id={records.biggestNightLoss.playerId}
                      name={records.biggestNightLoss.playerName}
                    />
                    )
                  </>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Largest pot night"
              value={
                records.largestPot ? (
                  <Link href={`/games/${records.largestPot.gameId}`} className="link">
                    {fmtMoney(records.largestPot.pot)} · {records.largestPot.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <Row
              label="Longest winning streak"
              value={
                records.longestWinStreak
                  ? `${records.longestWinStreak.length} (${records.longestWinStreak.player.playerName})`
                  : "—"
              }
            />
            <Row
              label="Longest losing streak"
              value={
                records.longestLossStreak
                  ? `${records.longestLossStreak.length} (${records.longestLossStreak.player.playerName})`
                  : "—"
              }
            />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Last 5 nights" />
          <ul className="divide-y">
            {closedNights.slice(0, 5).map((n) => (
              <li key={n.gameId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <Link href={`/games/${n.gameId}`} className="link text-sm font-medium">
                    {n.name}
                  </Link>
                  <div className="text-xs text-[var(--text-dim)]">
                    {fmtDate(n.date)} · {fmtMoney(n.pot)} · {n.playerCount} players
                  </div>
                </div>
                {n.winner ? (
                  <div className="shrink-0 text-right text-xs">
                    <PlayerLink id={n.winner.playerId} name={n.winner.playerName} />
                    <div>
                      <Money cents={n.winner.profit} signed />
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Night pot over time" subtitle={`${closedNights.length} nights`} />
          <BarChart
            bars={[...closedNights].reverse().map((n) => ({ value: n.pot, label: fmtDate(n.date) }))}
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Leaderboard snapshot"
            subtitle="Top 5 on each measure"
            action={
              <Link href="/stats/players" className="link text-xs">
                Full leaderboard →
              </Link>
            }
          />
          <div className="grid gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
            {BOARDS.map((b) => {
              const pool = b.eligibleOnly ? players.filter((p) => p.eligible) : players;
              const top = [...pool].sort(b.sort).slice(0, 5);
              return (
                <div key={b.key} className="bg-[var(--surface)] px-4 py-3">
                  <h3 className="mb-2 text-xs font-semibold text-[var(--text-dim)]">{b.label}</h3>
                  {top.length === 0 ? (
                    <p className="text-xs text-[var(--text-faint)]">No qualifiers.</p>
                  ) : (
                    <ol className="space-y-1.5 text-sm">
                      {top.map((p, i) => (
                        <li key={p.playerId} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate">
                            <span className="mr-1 text-xs text-[var(--text-faint)]">{i + 1}.</span>
                            <PlayerLink id={p.playerId} name={p.playerName} />
                          </span>
                          <span className="tabular shrink-0 text-xs">{b.value(p)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <dt className="min-w-0 text-[var(--text-dim)]">{label}</dt>
      <dd className="tabular min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
