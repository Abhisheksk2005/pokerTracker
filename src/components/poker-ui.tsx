import Link from "next/link";
import type { ReactNode } from "react";
import type { NightSummary } from "@/lib/metrics";
import { fmtDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import { Icon } from "@/components/icons";

export function initials(name: string) {
  return name.trim().split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

const AVATARS = ["#FF7A5A", "#B6A0EF", "#8FD694", "#F7C551", "#F6A5C0", "#85C8EA", "#C0A5FF", "#9EE493"];

export function Avatar({ name, coral = false }: { name: string; coral?: boolean }) {
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return <span className="player-avatar" style={{ background: coral ? "var(--accent)" : AVATARS[hash % AVATARS.length] }} aria-hidden="true">{initials(name)}</span>;
}

export function SectionTitle({ children, tone, href, action = "All" }: { children: ReactNode; tone?: "coral" | "violet"; href?: string; action?: string }) {
  return <div className="section-heading"><h2>{tone ? <span className={`section-icon section-icon-${tone}`}><Icon name={tone === "violet" ? "stats" : "cards"} size={16} /></span> : null}{children}</h2>{href ? <Link className="section-link" href={href}>{action}<Icon name="chevron" size={13} /></Link> : null}</div>;
}

export function NightStrip({ nights }: { nights: NightSummary[] }) {
  const recent = nights.slice(0, 7).reverse();
  const maxPot = Math.max(1, ...recent.map((night) => night.pot));
  return <div className="night-strip-wrap">
    <div className="night-strip" aria-label="Last seven poker nights">
      {Array.from({ length: 7 - recent.length }, (_, i) => <div className="night-strip-item" key={`empty-${i}`} aria-hidden="true"><span>–</span><div className="night-capsule night-capsule-empty"><i /></div></div>)}
      {recent.map((night, i) => <Link href={`/games/${night.gameId}`} className={`night-strip-item ${i === recent.length - 1 ? "night-strip-latest" : ""}`} key={night.gameId} title={`${night.name} · ${fmtDate(night.date)} · ${fmtMoney(night.pot)} pot`} aria-label={`${night.name}, ${fmtDate(night.date)}, ${fmtMoney(night.pot)} pot`}>
        <span>{night.date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1)}</span>
        <div className="night-capsule"><i style={{ background: night.pot / maxPot > 0.66 ? "var(--up)" : night.pot / maxPot > 0.4 ? "var(--violet)" : "var(--text-faint)" }} /></div>
      </Link>)}
    </div>
    <p className="strip-caption">{recent.length ? "Last 7 nights · pot size" : "Your next chapter starts at the table"}</p>
  </div>;
}

export function RecentNight({ night }: { night: NightSummary }) {
  return <Link href={`/games/${night.gameId}`} className="recent-night">
    <span className="night-date"><strong>{night.date.getDate()}</strong><span>{night.date.toLocaleDateString("en-US", { month: "short" })}</span></span>
    <span className="row-main"><strong>{night.name}</strong><span>{night.playerCount} players · {fmtMoney(night.pot)} pot</span></span>
    <span className="row-result"><strong style={{ color: night.status === "ACTIVE" ? "var(--accent)" : night.winner && night.winner.profit > 0 ? "var(--up)" : "var(--text-dim)" }}>{night.status === "ACTIVE" ? "Open" : night.winner?.playerName.split(" ")[0] ?? "—"}</strong><span>{night.status === "ACTIVE" ? "In progress" : night.winner ? fmtMoney(night.winner.profit, { sign: true }) : "No results"}</span></span>
  </Link>;
}
