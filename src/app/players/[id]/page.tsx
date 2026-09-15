import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart, WinLossStrip } from "@/components/charts";
import { Avatar } from "@/components/poker-ui";
import {
  Card,
  CardHeader,
  Empty,
  Money,
  PageHeader,
  Pct,
  PlayerLink,
  StatTile,
  StreakChip,
} from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { getTransactions, ledgerTotals } from "@/lib/ledger";
import {
  aggregatePlayers,
  cumulativeSeries,
  flattenRows,
  seasonOf,
  type NightRow,
} from "@/lib/metrics";
import { fmtMoney, fmtNum } from "@/lib/money";
import { getLeagueView, getPlayer } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const view = await getLeagueView("all");
  const me = view.players.find((p) => p.playerId === id);
  const allTimeRank = view.players.findIndex((p) => p.playerId === id) + 1;

  const currentSeason = view.closedNights.length ? seasonOf(view.closedNights[0].date) : null;
  const seasonNights = currentSeason
    ? view.closedNights.filter((n) => seasonOf(n.date) === currentSeason)
    : [];
  const seasonPlayers = aggregatePlayers(flattenRows(seasonNights));
  const seasonMe = seasonPlayers.find((p) => p.playerId === id);
  const seasonRank = seasonPlayers.findIndex((p) => p.playerId === id) + 1;

  const ledger = await getTransactions({ playerId: id });
  const totals = ledgerTotals(ledger);

  const header = (
    <PageHeader
      title={<span className="player-profile-heading"><Avatar name={player.name} /><span>{player.name}</span></span>}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {player.nickname ? <span className="chip">“{player.nickname}”</span> : null}
          <span className={`chip ${player.active ? "chip-up" : ""}`}>
            {player.active ? "Active" : "Inactive"}
          </span>
          {me ? (
            <>
              <span>{me.nights} nights played</span>
              <span>·</span>
              <span>Ranked #{allTimeRank} all-time</span>
              {seasonMe ? (
                <>
                  <span>·</span>
                  <span>
                    #{seasonRank} in {currentSeason}
                  </span>
                </>
              ) : null}
            </>
          ) : (
            <span>No results recorded yet</span>
          )}
        </span>
      }
      action={
        <>
          <Link href={`/transactions?playerId=${id}`} className="btn">
            Ledger
          </Link>
          <Link href={`/players/${id}/edit`} className="btn">
            Edit
          </Link>
          <Link href="/players" className="btn">
            All players
          </Link>
        </>
      }
    />
  );

  if (!me) {
    return (
      <>
        {header}
        <Card>
          <Empty>
            <p className="mb-3">{player.name} has no finished-night results yet.</p>
            <Link href="/games/new" className="btn btn-primary">
              Start a night
            </Link>
          </Empty>
        </Card>
      </>
    );
  }

  const series = cumulativeSeries(me.rows);
  const bySeason = groupBySeason(me.rows);
  const recent = [...me.rows].reverse();

  return (
    <>
      {header}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="All-time profit"
          value={fmtMoney(me.profit, { sign: true })}
          tone={me.profit >= 0 ? "up" : "down"}
          hint={`${me.nights} nights`}
        />
        <StatTile label="Total buy-ins" value={fmtMoney(me.buyIn)} hint="Money risked" />
        <StatTile
          label="Overall ROI"
          value={<Pct value={me.roi} />}
          hint={`Score ${fmtNum(me.score)}`}
        />
        <StatTile
          label="Current streak"
          value={<StreakChip type={me.currentStreak.type} length={me.currentStreak.length} />}
          hint={`Longest win streak: ${me.longestWinStreak}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Profit over time" subtitle="Cumulative, oldest night first" />
            <LineChart
              points={series.map((s, i) => ({
                x: i,
                y: s.cumulativeProfit,
                label: fmtDate(s.date),
              }))}
            />
          </Card>

          <Card>
            <CardHeader title="ROI over time" subtitle="Running return on every dollar bought in" />
            <LineChart
              points={series.map((s, i) => ({ x: i, y: s.roi, label: fmtDate(s.date) }))}
              format="pct"
            />
          </Card>

          <Card>
            <CardHeader title={`Win / loss (last ${Math.min(me.rows.length, 20)} nights)`} />
            <WinLossStrip results={me.rows.slice(-20).map((r) => r.profit)} />
          </Card>

          <Card>
            <CardHeader
              title="Night by night"
              subtitle={`${me.rows.length} nights. Click through for full results.`}
            />
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Night</th>
                    <th className="num">In</th>
                    <th className="num">Out</th>
                    <th className="num">Result</th>
                    <th className="num">ROI</th>
                    <th className="num">Pot</th>
                    <th className="num">Pot share</th>
                    <th className="num">Score</th>
                    <th className="num">Place</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={`${r.gameId}`}>
                      <td className="text-[var(--text-dim)]">{fmtDate(r.date)}</td>
                      <td>
                        <Link href={`/games/${r.gameId}`} className="link">
                          {r.gameName}
                        </Link>
                      </td>
                      <td className="num">{fmtMoney(r.buyIn)}</td>
                      <td className="num">{fmtMoney(r.cashOut)}</td>
                      <td className="num">
                        <Money cents={r.profit} signed />
                      </td>
                      <td className="num">
                        <Pct value={r.roi} />
                      </td>
                      <td className="num text-[var(--text-dim)]">{fmtMoney(r.pot)}</td>
                      <td className="num text-[var(--text-dim)]">
                        <Pct value={r.potShare} />
                      </td>
                      <td className="num">{fmtNum(r.nightScore)}</td>
                      <td className="num">#{r.place}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <NightCard title="Best night" row={me.bestNight} />
            <NightCard title="Worst night" row={me.worstNight} />
          </div>

          <Card>
            <CardHeader title="Season results" subtitle="Same formulas, applied per season" />
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Season</th>
                    <th className="num">Nights</th>
                    <th className="num">In</th>
                    <th className="num">Out</th>
                    <th className="num">Profit</th>
                    <th className="num">ROI</th>
                    <th className="num">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-semibold">
                    <td>All time</td>
                    <td className="num">{me.nights}</td>
                    <td className="num">{fmtMoney(me.buyIn)}</td>
                    <td className="num">{fmtMoney(me.cashOut)}</td>
                    <td className="num">
                      <Money cents={me.profit} signed />
                    </td>
                    <td className="num">
                      <Pct value={me.roi} />
                    </td>
                    <td className="num">{fmtNum(me.score)}</td>
                  </tr>
                  {bySeason.map((s) => (
                    <tr key={s.season}>
                      <td>{s.season}</td>
                      <td className="num">{s.nights}</td>
                      <td className="num">{fmtMoney(s.buyIn)}</td>
                      <td className="num">{fmtMoney(s.cashOut)}</td>
                      <td className="num">
                        <Money cents={s.profit} signed />
                      </td>
                      <td className="num">
                        <Pct value={s.roi} />
                      </td>
                      <td className="num">{fmtNum(s.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Record" />
            <dl className="divide-y text-sm">
              <Row label="Nights won" value={`${me.won} / ${me.nights}`} />
              <Row label="Win rate" value={<Pct value={me.winRate} />} />
              <Row
                label="Podium points"
                value={`${me.podiumPoints} pts (3/2/1 for 1st/2nd/3rd)`}
              />
              <Row label="Nights in profit" value={`${me.inProfit} / ${me.nights}`} />
              <Row label="Rebuys" value={String(me.rebuys)} />
              <Row label="Heater nights" value={String(me.heaterNights)} />
              <Row label="Avg pot share" value={<Pct value={me.avgPotShare} />} />
              <Row label="Longest losing streak" value={String(me.longestLossStreak)} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Cash ledger"
              subtitle="Actual money handed over"
              action={
                <Link href={`/transactions?playerId=${id}`} className="link text-xs">
                  Open →
                </Link>
              }
            />
            <dl className="divide-y text-sm">
              <Row label="Transactions" value={String(totals.count)} />
              <Row label="Cash in (from player)" value={fmtMoney(totals.moneyIn)} />
              <Row label="Cash out (to player)" value={fmtMoney(totals.moneyOut)} />
              <Row
                label="Ledger balance"
                value={<Money cents={totals.net} signed bold />}
              />
              <Row
                label="Matches results?"
                value={
                  totals.net === me.profit ? (
                    <span className="chip chip-up">Square</span>
                  ) : (
                    <span className="chip chip-down">
                      off by {fmtMoney(Math.abs(totals.net - me.profit))}
                    </span>
                  )
                }
              />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Performance comparison"
              subtitle={currentSeason ? `Top 5 · ${currentSeason}` : "Top 5"}
            />
            <ComparisonTable rows={seasonPlayers.slice(0, 5)} meId={id} />
            <CardHeader title="Top 5 · all-time" subtitle={`You: #${allTimeRank} of ${view.players.length}`} />
            <ComparisonTable rows={view.players.slice(0, 5)} meId={id} />
          </Card>

          {player.notes ? (
            <Card>
              <CardHeader title="Notes" />
              <p className="px-4 py-3 text-sm whitespace-pre-wrap">{player.notes}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function groupBySeason(rows: NightRow[]) {
  const map = new Map<number, NightRow[]>();
  for (const r of rows) {
    const s = seasonOf(r.date);
    const list = map.get(s);
    if (list) list.push(r);
    else map.set(s, [r]);
  }
  return [...map.entries()]
    .map(([season, list]) => {
      const buyIn = list.reduce((s, r) => s + r.buyIn, 0);
      const cashOut = list.reduce((s, r) => s + r.cashOut, 0);
      const profit = list.reduce((s, r) => s + r.profit, 0);
      const roi = buyIn > 0 ? profit / buyIn : null;
      return {
        season,
        nights: list.length,
        buyIn,
        cashOut,
        profit,
        roi,
        score: roi === null ? null : roi * Math.sqrt(buyIn / 100),
      };
    })
    .sort((a, b) => b.season - a.season);
}

function NightCard({ title, row }: { title: string; row: NightRow | null }) {
  if (!row) {
    return (
      <Card>
        <CardHeader title={title} />
        <Empty>No nights yet.</Empty>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title={title} subtitle={fmtDate(row.date)} />
      <div className="px-4 py-3">
        <Link href={`/games/${row.gameId}`} className="link text-sm font-medium">
          {row.gameName}
        </Link>
        <div className="mt-2 text-2xl font-bold">
          <Money cents={row.profit} signed />
        </div>
        <dl className="mt-2 space-y-1 text-xs text-[var(--text-dim)]">
          <div className="flex justify-between">
            <dt>Buy-in</dt>
            <dd className="tabular">{fmtMoney(row.buyIn)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Cash-out</dt>
            <dd className="tabular">{fmtMoney(row.cashOut)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>ROI</dt>
            <dd className="tabular">
              <Pct value={row.roi} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Pot share</dt>
            <dd className="tabular">
              <Pct value={row.potShare} />
            </dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}

function ComparisonTable({
  rows,
  meId,
}: {
  rows: { playerId: string; playerName: string; profit: number; roi: number | null }[];
  meId: string;
}) {
  if (rows.length === 0) return <Empty>No data.</Empty>;
  return (
    <div className="scroll-x">
      <table className="tbl">
        <thead>
          <tr>
            <th className="num">Rank</th>
            <th>Player</th>
            <th className="num">Profit</th>
            <th className="num">ROI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.playerId} className={p.playerId === meId ? "font-semibold" : ""}>
              <td className="num text-[var(--text-faint)]">#{i + 1}</td>
              <td>
                <PlayerLink id={p.playerId} name={p.playerName} />
                {p.playerId === meId ? (
                  <span className="ml-1 text-xs text-[var(--text-faint)]">(you)</span>
                ) : null}
              </td>
              <td className="num">
                <Money cents={p.profit} signed />
              </td>
              <td className="num">
                <Pct value={p.roi} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2">
      <dt className="text-[var(--text-dim)]">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}
