import Link from "next/link";
import { Icon } from "@/components/icons";
import { Card, Empty, Money, StatusChip } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { getLeagueView, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 8;

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ scope?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const status = sp.status === "ACTIVE" || sp.status === "CLOSED" ? sp.status : "ALL";
  const view = await getLeagueView(scope);
  const all = view.nights;
  const filtered = status === "ALL" ? all : all.filter((n) => n.status === status);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Math.floor(Number(sp.page) || 1)), pages);
  const slice = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const counts = { ALL: all.length, ACTIVE: all.filter((n) => n.status === "ACTIVE").length, CLOSED: all.filter((n) => n.status === "CLOSED").length };
  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { scope: scope === "all" ? undefined : String(scope), status: status === "ALL" ? undefined : status, page: current === 1 ? undefined : String(current), ...patch };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    return `/games${params.size ? `?${params}` : ""}`;
  };

  return <>
    <h1 className="sr-only">Games</h1>
    <div className="page-toolbar"><span className="eyebrow">Your nights<br />at the table</span><Link href="/games/new" className="btn btn-primary"><Icon name="plus" size={16} />New night</Link></div>
    <nav className="filter-chips" aria-label="Game season">{(["all", ...view.seasons] as const).map((season) => <Link key={season} href={link({ scope: season === "all" ? undefined : String(season), page: undefined })} aria-current={season === scope ? "true" : undefined} className={`filter-chip ${season === scope ? "filter-chip-active" : ""}`}>{season === "all" ? "All time" : season}</Link>)}</nav>
    <nav className="segmented-control" aria-label="Game status">{(["ALL", "ACTIVE", "CLOSED"] as const).map((value) => <Link key={value} href={link({ status: value === "ALL" ? undefined : value, page: undefined })} aria-current={value === status ? "true" : undefined} className={value === status ? "segment-active" : ""}>{value === "ALL" ? "All" : value === "ACTIVE" ? "Active" : "Closed"} <span className="text-xs opacity-70">{counts[value]}</span></Link>)}</nav>
    {!slice.length ? <Card><Empty><p className="mb-3">No nights match this filter.</p><Link href="/games/new" className="btn btn-primary">Start a night</Link></Empty></Card> : <div className="flex flex-col gap-[11px]">{slice.map((night) => <Card className="game-card" key={night.gameId}>
      <Link href={`/games/${night.gameId}`} className="game-card-summary">
        <div className="game-card-meta"><StatusChip status={night.status} /><span className="game-date-label"><Icon name="calendar" size={13} />{fmtDate(night.date)}</span></div>
        <h2>{night.name}</h2>
        <div className="game-card-facts"><div><div className="eyebrow"><Icon name="chips" size={12} />Pot</div><strong>{fmtMoney(night.pot)}</strong></div><div><div className="eyebrow"><Icon name="players" size={12} />Players</div><strong>{night.playerCount}</strong></div><div><div className="eyebrow"><Icon name="trophy" size={12} />{night.status === "ACTIVE" ? "Leading" : "Winner"}</div><strong className="text-[var(--up)]">{night.winner?.playerName ?? "—"}</strong></div></div>
      </Link>
      {night.rows.length ? <ol className="game-card-results">{night.rows.map((row) => <li className="game-result" key={row.playerId}><span className="result-rank">{row.place}</span><Link href={`/players/${row.playerId}`}>{row.playerName}</Link><Money cents={row.profit} signed /></li>)}</ol> : <p className="px-4 pb-4 text-xs text-[var(--text-dim)]">Ready for the first buy-in.</p>}
      {night.bankDelta !== 0 ? <div className="px-4 pb-3 text-xs text-[var(--text-dim)]">Bank delta <span className="text-[var(--down)]">{fmtMoney(night.bankDelta, { sign: true })}</span></div> : null}
    </Card>)}</div>}
    {pages > 1 ? <div className="mt-5 flex items-center justify-between"><Link href={link({ page: String(Math.max(1, current - 1)) })} className={`btn btn-sm ${current === 1 ? "pointer-events-none opacity-40" : ""}`} aria-disabled={current === 1}>Previous</Link><span className="text-xs text-[var(--text-dim)]">Page {current} of {pages}</span><Link href={link({ page: String(Math.min(pages, current + 1)) })} className={`btn btn-sm ${current === pages ? "pointer-events-none opacity-40" : ""}`} aria-disabled={current === pages}>Next</Link></div> : null}
  </>;
}
