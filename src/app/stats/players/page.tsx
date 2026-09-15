import { Sparkline } from "@/components/charts";
import { Card, CardHeader, Empty, Money, Pct, PlayerLink } from "@/components/ui";
import { cumulativeSeries, formWindow, MIN_NIGHTS_FOR_ELIGIBILITY } from "@/lib/metrics";
import { fmtMoney, fmtNum } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

const FORM_WINDOW = 10;

export default async function StatsPlayers({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const view = await getLeagueView(parseScope(sp.scope));
  const { players, closedNights } = view;

  if (players.length === 0) {
    return (
      <Card>
        <Empty>No player results in this scope.</Empty>
      </Card>
    );
  }

  const form = formWindow(closedNights, FORM_WINDOW)
    .slice(0, 10)
    .map((p) => ({
      ...p,
      spark: cumulativeSeries(p.rows).map((s) => s.cumulativeProfit),
    }));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title={`Leaderboard (${players.length} players)`}
          subtitle={`Rate-based columns need ${MIN_NIGHTS_FOR_ELIGIBILITY}+ nights to qualify.`}
        />
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Player</th>
                <th className="num">Nights</th>
                <th className="num">Buy-in</th>
                <th className="num">Cash-out</th>
                <th className="num">Profit</th>
                <th className="num">ROI</th>
                <th className="num">Score</th>
                <th className="num">Profit rate</th>
                <th className="num">Best night</th>
                <th className="num">Worst night</th>
                <th className="num">Heaters</th>
                <th>Eligibility</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={p.playerId}>
                  <td className="num text-[var(--text-faint)]">{i + 1}</td>
                  <td className="font-medium">
                    <PlayerLink id={p.playerId} name={p.playerName} />
                  </td>
                  <td className="num">{p.nights}</td>
                  <td className="num">{fmtMoney(p.buyIn)}</td>
                  <td className="num">{fmtMoney(p.cashOut)}</td>
                  <td className="num">
                    <Money cents={p.profit} signed />
                  </td>
                  <td className="num">
                    <Pct value={p.roi} />
                  </td>
                  <td className="num">{fmtNum(p.score)}</td>
                  <td className="num">
                    <Pct value={p.profitRate} />
                  </td>
                  <td className="num">
                    {p.bestNight ? <Money cents={p.bestNight.profit} signed /> : "—"}
                  </td>
                  <td className="num">
                    {p.worstNight ? <Money cents={p.worstNight.profit} signed /> : "—"}
                  </td>
                  <td className="num">{p.heaterNights}</td>
                  <td>
                    <span className={`chip ${p.eligible ? "" : "chip-accent"}`}>
                      {p.eligible ? "Eligible" : "Min"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`Form (last ${FORM_WINDOW} nights)`}
          subtitle="Top 10 by profit in the rolling window"
        />
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Player</th>
                <th className="num">Nights</th>
                <th className="num">Profit</th>
                <th className="num">ROI</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {form.map((p) => (
                <tr key={p.playerId}>
                  <td className="font-medium">
                    <PlayerLink id={p.playerId} name={p.playerName} />
                  </td>
                  <td className="num">{p.nights}</td>
                  <td className="num">
                    <Money cents={p.profit} signed />
                  </td>
                  <td className="num">
                    <Pct value={p.roi} />
                  </td>
                  <td>
                    <Sparkline values={p.spark} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
