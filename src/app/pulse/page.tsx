import Link from "next/link";
import { Avatar, initials, NightStrip, RecentNight, SectionTitle } from "@/components/poker-ui";
import { StatTile } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { competitivenessLabel, formWindow } from "@/lib/metrics";
import { fmtMoney, fmtPct } from "@/lib/money";
import { getActiveGroup } from "@/lib/groups";
import { getLeagueView } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [view, active] = await Promise.all([getLeagueView("all"), getActiveGroup()]);
  const { closedNights, players, summary, records } = view;
  const last = view.nights[0];
  const totalPot = view.nights.reduce((sum, night) => sum + night.pot, 0);
  const leader = players[0];
  const hot = formWindow(closedNights, 3).filter((p) => p.profit > 0).slice(0, 5);
  const streaks = [...players].filter((p) => p.currentStreak.length > 0).sort((a, b) => b.currentStreak.length - a.currentStreak.length).slice(0, 5);
  const maxProfit = Math.max(1, ...players.map((p) => Math.abs(p.profit)));
  const bestRoi = closedNights.flatMap((night) => night.rows).filter((row) => row.roi !== null).sort((a, b) => b.roi! - a.roi!)[0];
  const moments = [
    { label: "Biggest win", row: records.biggestNightProfit },
    { label: "Deepest hole", row: records.biggestNightLoss },
  ];

  return <div className="pulse-page">
    <header className="pulse-heading">
      <div className="eyebrow">League pulse</div>
      <h1>{last ? `${last.status === "ACTIVE" ? "Latest night" : "Last night"}, ${last.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Your table awaits."}</h1>
    </header>
    <NightStrip nights={view.nights} />
    <div className="pulse-kpis">
      <StatTile label="Nights logged" value={view.nights.length} hint={`${view.seasons.length} ${view.seasons.length === 1 ? "season" : "seasons"}`} />
      <StatTile label="Money moved" value={fmtMoney(totalPot)} hint="Total pot" />
      <StatTile label="Avg pot" value={<span className="text-[var(--violet)]">{fmtMoney(view.nights.length ? Math.round(totalPot / view.nights.length) : 0)}</span>} hint="Per night" />
      <StatTile label="League leader" value={leader ? <Link href={`/players/${leader.playerId}`}>{leader.playerName.split(" ")[0]}</Link> : "—"} hint={leader ? fmtMoney(leader.profit, { sign: true }) : "The seat is open"} tone={leader && leader.profit > 0 ? "up" : "neutral"} />
    </div>

    {!closedNights.length ? <section className="pulse-section welcome-card">
      <div className="eyebrow">{active.name}</div><h2>{last ? "The night is still young." : "Make it a poker night."}</h2>
      <p>{last ? "Finish a night to reveal your league leader, hot streaks and big moments." : "Your results, rivalries and big moments start with your first finished night."}</p>
      <div className="flex flex-wrap gap-2"><Link href={last ? `/games/${last.gameId}` : "/games/new"} className="btn btn-primary">{last ? "Continue night" : "Start a night"}</Link><Link href="/players/new" className="btn">Add players</Link></div>
    </section> : null}

    <section className="pulse-section">
      <SectionTitle tone="coral">Who&apos;s hot</SectionTitle>
      {hot.length ? <div className="card-rail hot-rail">{hot.map((p) => <Link href={`/players/${p.playerId}`} className="hot-card" key={p.playerId}>
        <div className="flex items-center gap-2"><Avatar name={p.playerName} coral /><span className="mono text-[11px] text-[#ff8a72]">{p.currentStreak.type === "W" ? `${p.currentStreak.length}W` : fmtPct(p.roi, 0)}</span></div>
        <h3>{p.playerName.split(" ")[0]}</h3><strong className="hot-profit">{fmtMoney(p.profit, { sign: true })}</strong><p>Last {Math.min(3, closedNights.length)} nights</p>
      </Link>)}</div> : <p className="section-empty">{closedNights.length ? "No players in profit over the last three nights." : "The next hot streak could be yours."}</p>}
    </section>

    <section className="pulse-section"><SectionTitle href="/games">Recent nights</SectionTitle>
      <div className="night-list">{view.nights.slice(0, 4).map((night) => <RecentNight key={night.gameId} night={night} />)}</div>
      {!view.nights.length ? <p className="section-empty">Your nights will appear here once you start playing.</p> : null}
    </section>

    <section className="pulse-section"><SectionTitle tone="violet">Big moments</SectionTitle>
      <div className="moment-list">
        {moments.map(({ label, row }) => <Link href={row ? `/games/${row.gameId}` : "/games/new"} className="moment-card" key={label}><div className="eyebrow">{label}</div><strong>{row ? fmtMoney(row.profit, { sign: true }) : "Still to come"}</strong><p>{row ? `${row.playerName} · ${fmtDate(row.date)}` : "A new story with every hand"}</p></Link>)}
        <Link className="moment-card" href={bestRoi ? `/games/${bestRoi.gameId}` : "/games/new"}><div className="eyebrow">Best ROI night</div><strong>{bestRoi ? fmtPct(bestRoi.roi, 0) : "—"}</strong><p>{bestRoi ? `${bestRoi.playerName} · ${fmtDate(bestRoi.date)}` : "Your best night is ahead"}</p></Link>
        <Link className="moment-card" href={records.largestPot ? `/games/${records.largestPot.gameId}` : "/games/new"}><div className="eyebrow">Largest pot</div><strong>{records.largestPot ? fmtMoney(records.largestPot.pot) : "—"}</strong><p>{records.largestPot ? `${records.largestPot.name} · ${fmtDate(records.largestPot.date)}` : "Bring everyone to the table"}</p></Link>
      </div>
    </section>

    {players.length ? <>
      <section className="pulse-section"><SectionTitle>Streaks</SectionTitle><div className="card-rail">{streaks.map((p) => <Link className="streak-card" href={`/players/${p.playerId}`} key={p.playerId}><h3>{p.playerName.split(" ")[0]}</h3><strong style={{ color: p.currentStreak.type === "W" ? "var(--up)" : "var(--down)" }}>{p.currentStreak.length}{p.currentStreak.type}</strong><div className="eyebrow">{p.currentStreak.type === "W" ? "Win streak" : "Loss streak"}</div></Link>)}</div>{!streaks.length ? <p className="section-empty">No active streaks yet.</p> : null}</section>
      <section className="pulse-section"><SectionTitle href="/players">Top winners</SectionTitle><div className="winner-list">{players.slice(0, 5).map((p, i) => <Link href={`/players/${p.playerId}`} key={p.playerId} className="winner-row"><div><strong>{i + 1} &nbsp; {p.playerName}</strong><span className="mono" style={{ color: p.profit >= 0 ? "var(--up)" : "var(--down)" }}>{fmtMoney(p.profit, { sign: true })}</span></div><div className="winner-track"><span style={{ width: `${Math.abs(p.profit) / maxProfit * 100}%`, background: p.profit >= 0 ? "var(--up)" : "var(--down)" }} /></div></Link>)}</div></section>
      <section className="pulse-section"><SectionTitle>Profit distribution</SectionTitle><p className="section-caption">{competitivenessLabel(summary.topShareOfPositive)} · all-time results</p><div className="profit-chart">{players.map((p) => <Link href={`/players/${p.playerId}`} key={p.playerId} className="profit-column" title={`${p.playerName}: ${fmtMoney(p.profit, { sign: true })}`} aria-label={`${p.playerName}: ${fmtMoney(p.profit, { sign: true })}`}><div className="profit-positive"><span style={{ height: `${Math.max(0, p.profit) / maxProfit * 100}%` }} /></div><div className="profit-negative"><span style={{ height: `${Math.max(0, -p.profit) / maxProfit * 100}%` }} /></div><span className="mono">{initials(p.playerName)}</span></Link>)}</div></section>
    </> : null}
    <div className="pulse-section flex flex-wrap gap-2"><Link href="/games/new" className="btn btn-primary">New night</Link><Link href="/transactions/new" className="btn">Record payment</Link><Link href="/groups" className="btn">Group settings</Link></div>
  </div>;
}
