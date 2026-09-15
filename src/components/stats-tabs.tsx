"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
const TABS = [
  { href: "/stats", label: "Overview" },
  { href: "/stats/players", label: "Players" },
  { href: "/stats/seasons", label: "Seasons" },
  { href: "/stats/nights", label: "Nights" },
  { href: "/stats/insights", label: "Insights" },
];
export function StatsTabs(props: { seasons: number[]; static?: boolean }) {
  return props.static ? <TabsView seasons={props.seasons} pathname={null} requested="all" /> : <LiveTabs seasons={props.seasons} />;
}

function LiveTabs({ seasons }: { seasons: number[] }) {
  return <TabsView seasons={seasons} pathname={usePathname()} requested={useSearchParams().get("scope") ?? "all"} />;
}

/** Rendered once without search params (Suspense fallback) and again live, with identical layout. */
function TabsView({ seasons, pathname: current, requested }: { seasons: number[]; pathname: string | null; requested: string }) {
  const pathname = current ?? "/stats";
  const scope = seasons.map(String).includes(requested) ? requested : "all";
  const qs = scope === "all" ? "" : `?scope=${scope}`;
  return <div className="mb-5">
    <nav className="stats-tabs filter-chips" aria-label="Statistics sections">{TABS.map((tab) => <Link key={tab.href} href={`${tab.href}${qs}`} aria-current={current === tab.href ? "page" : undefined} className={`filter-chip ${current === tab.href ? "filter-chip-active" : ""}`}>{tab.label}</Link>)}</nav>
    {seasons.length ? <nav className="filter-chips mt-3" aria-label="Statistics season">{["all", ...seasons.map(String)].map((season) => <Link key={season} href={`${pathname}${season === "all" ? "" : `?scope=${season}`}`} aria-current={season === scope ? "true" : undefined} className={`filter-chip ${season === scope ? "filter-chip-active" : ""}`}>{season === "all" ? "All time" : season}</Link>)}</nav> : null}
  </div>;
}
