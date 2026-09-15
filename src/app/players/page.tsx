import Link from "next/link";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/poker-ui";
import { Card, Empty } from "@/components/ui";
import { MIN_NIGHTS_FOR_ELIGIBILITY, type PlayerAggregate } from "@/lib/metrics";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/money";
import { getLeagueView, getPlayers, parseScope } from "@/lib/queries";

export const dynamic = "force-dynamic";
const SORTS = {
  profit: { label: "Profit", value: (p: PlayerAggregate) => p.profit, format: (p: PlayerAggregate) => fmtMoney(p.profit, { sign: true }) },
  buyIn: { label: "Buy-ins", value: (p: PlayerAggregate) => p.buyIn, format: (p: PlayerAggregate) => fmtMoney(p.buyIn) },
  roi: { label: "ROI", value: (p: PlayerAggregate) => p.roi ?? -Infinity, format: (p: PlayerAggregate) => fmtPct(p.roi) },
  score: { label: "Score", value: (p: PlayerAggregate) => p.score ?? -Infinity, format: (p: PlayerAggregate) => fmtNum(p.score) },
  nights: { label: "Nights", value: (p: PlayerAggregate) => p.nights, format: (p: PlayerAggregate) => String(p.nights) },
  won: { label: "Won", value: (p: PlayerAggregate) => p.won, format: (p: PlayerAggregate) => String(p.won) },
  podium: { label: "Podium", value: (p: PlayerAggregate) => p.podiumPoints, format: (p: PlayerAggregate) => String(p.podiumPoints) },
  winRate: { label: "Win rate", value: (p: PlayerAggregate) => p.winRate ?? -Infinity, format: (p: PlayerAggregate) => fmtPct(p.winRate) },
  inProfit: { label: "In profit", value: (p: PlayerAggregate) => p.profitRate ?? -Infinity, format: (p: PlayerAggregate) => fmtPct(p.profitRate) },
  name: { label: "Name", value: () => 0, format: (p: PlayerAggregate) => fmtMoney(p.profit, { sign: true }) },
} as const;
type SortKey = keyof typeof SORTS;

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string; scope?: string }> }) {
  const sp = await searchParams;
  const scope = parseScope(sp.scope);
  const sort: SortKey = sp.sort && Object.hasOwn(SORTS, sp.sort) ? sp.sort as SortKey : "profit";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const metric = SORTS[sort];
  const [view, roster] = await Promise.all([getLeagueView(scope), getPlayers()]);
  const ranked = [...view.players].sort(sort === "name" ? (a, b) => a.playerName.localeCompare(b.playerName) : (a, b) => metric.value(b) - metric.value(a));
  if (dir === "asc") ranked.reverse();
  const playedIds = new Set(view.players.map((p) => p.playerId));
  const neverPlayed = roster.filter((p) => !playedIds.has(p.id));
  const link = (key: SortKey, season = scope, direction = key === sort && dir === "desc" ? "asc" : "desc") => {
    const params = new URLSearchParams({ sort: key, dir: direction });
    if (season !== "all") params.set("scope", String(season));
    return `/players?${params}`;
  };

  return <>
    <h1 className="sr-only">Players</h1>
    <div className="page-toolbar"><span className="eyebrow">{roster.length} at the table</span><Link className="btn btn-primary" href="/players/new"><Icon name="plus" size={16} />Add player</Link></div>
    {view.seasons.length ? <nav className="filter-chips mb-3" aria-label="Player season">{(["all", ...view.seasons] as const).map((season) => <Link key={season} href={link(sort, season, dir)} className={`filter-chip ${season === scope ? "filter-chip-active" : ""}`} aria-current={season === scope ? "true" : undefined}>{season === "all" ? "All time" : season}</Link>)}</nav> : null}
    <nav className="filter-chips" aria-label="Rank players by">{(Object.keys(SORTS) as SortKey[]).map((key) => <Link href={link(key)} key={key} className={`filter-chip ${key === sort ? "filter-chip-active" : ""}`} aria-current={key === sort ? "true" : undefined}>{SORTS[key].label}{key === sort ? dir === "desc" ? " ↓" : " ↑" : ""}</Link>)}</nav>
    {!ranked.length && !neverPlayed.length ? <Card className="mt-4"><Empty><p className="mb-3">Every great night starts with your people.</p><Link href="/players/new" className="btn btn-primary">Add your first player</Link></Empty></Card> : null}
    <div className="leaderboard">{ranked.map((p, index) => {
      const signed = sort === "profit" || sort === "roi" || sort === "score" || sort === "name";
      const value = sort === "name" ? p.profit : metric.value(p);
      const color = signed ? value > 0 ? "var(--up)" : value < 0 && Number.isFinite(value) ? "var(--down)" : "var(--text-dim)" : ["won", "podium", "winRate"].includes(sort) ? "var(--violet)" : "var(--text)";
      return <Link href={`/players/${p.playerId}`} className="leaderboard-row" key={p.playerId}>
        <span className="leaderboard-rank">{index + 1}</span><Avatar name={p.playerName} />
        <span className="row-main"><strong>{p.playerName}</strong><span>{p.nights} nights · {p.won}W · {fmtPct(p.profitRate, 0)} in profit</span></span>
        <span className="row-result"><strong style={{ color }}>{metric.format(p)}</strong><span>{sort === "name" ? "Profit" : metric.label}</span></span>
      </Link>;
    })}
    {neverPlayed.map((p) => <Link href={`/players/${p.id}`} className="leaderboard-row" key={p.id}><span className="leaderboard-rank">–</span><Avatar name={p.name} /><span className="row-main"><strong>{p.name}</strong><span>{p.active ? "No results in this scope" : "Inactive · no results"}</span></span><span className="row-result"><strong>—</strong><span>{sort === "name" ? "Profit" : metric.label}</span></span></Link>)}
    </div>
    {ranked.length ? <p className="mt-4 text-xs leading-5 text-[var(--text-faint)]">{MIN_NIGHTS_FOR_ELIGIBILITY}+ nights to qualify for rate-based rankings. Select a player for their complete results.</p> : null}
    <Link className="btn full-width-action" href="/groups">Manage players</Link>
  </>;
}
