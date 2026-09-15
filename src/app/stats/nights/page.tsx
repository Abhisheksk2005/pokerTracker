import Link from "next/link";
import { Card, CardHeader, Empty, Money, PlayerLink, StatusChip } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function StatsNights({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const view = await getLeagueView(parseScope(sp.scope));
  const nights = view.nights;

  if (nights.length === 0) {
    return (
      <Card>
        <Empty>No nights in this scope.</Empty>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={`Nights (${nights.length})`}
        subtitle="Every night with its pot, field size and the extremes"
      />
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Night</th>
              <th>Status</th>
              <th className="num">Pot</th>
              <th className="num">Players</th>
              <th className="num">Rebuys</th>
              <th>Biggest winner</th>
              <th>Biggest loser</th>
              <th className="num">Bank delta</th>
            </tr>
          </thead>
          <tbody>
            {nights.map((n) => (
              <tr key={n.gameId}>
                <td className="text-[var(--text-dim)]">{fmtDate(n.date)}</td>
                <td>
                  <Link href={`/games/${n.gameId}`} className="link font-medium">
                    {n.name}
                  </Link>
                </td>
                <td>
                  <StatusChip status={n.status} />
                </td>
                <td className="num">{fmtMoney(n.pot)}</td>
                <td className="num">{n.playerCount}</td>
                <td className="num">{n.rebuys}</td>
                <td>
                  {n.winner ? (
                    <>
                      <PlayerLink id={n.winner.playerId} name={n.winner.playerName} />{" "}
                      <Money cents={n.winner.profit} signed />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {n.loser ? (
                    <>
                      <PlayerLink id={n.loser.playerId} name={n.loser.playerName} />{" "}
                      <Money cents={n.loser.profit} signed />
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">
                  {n.bankDelta === 0 ? (
                    <span className="chip chip-up">Balanced</span>
                  ) : (
                    <span className="chip chip-down">{fmtMoney(n.bankDelta, { sign: true })}</span>
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
