import { Card, CardHeader, Empty, Money, Pct, PlayerLink } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { seasonSummaries } from "@/lib/metrics";
import { fmtMoney } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StatsSeasons({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const view = await getLeagueView(parseScope(sp.scope));
  const seasons = seasonSummaries(view.closedNights);

  if (seasons.length === 0) {
    return (
      <Card>
        <Empty>No seasons in this scope.</Empty>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Seasons"
        subtitle="A season is a calendar year — nights, pot size and who owned it"
      />
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Season</th>
              <th>Date range</th>
              <th className="num">Nights</th>
              <th className="num">Total pot</th>
              <th className="num">Avg pot</th>
              <th className="num">Players</th>
              <th>Most profitable</th>
              <th>Best ROI</th>
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.season}>
                <td className="font-semibold">{s.season}</td>
                <td className="text-[var(--text-dim)]">
                  {fmtDate(s.firstDate)} – {fmtDate(s.lastDate)}
                </td>
                <td className="num">{s.nights}</td>
                <td className="num">{fmtMoney(s.totalPot)}</td>
                <td className="num">{fmtMoney(s.avgPot)}</td>
                <td className="num">{s.players}</td>
                <td>
                  {s.mostProfitable ? (
                    <>
                      <PlayerLink
                        id={s.mostProfitable.playerId}
                        name={s.mostProfitable.playerName}
                      />{" "}
                      <Money cents={s.mostProfitable.profit} signed />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {s.bestRoi ? (
                    <>
                      <PlayerLink id={s.bestRoi.playerId} name={s.bestRoi.playerName} />{" "}
                      <Pct value={s.bestRoi.roi} />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
