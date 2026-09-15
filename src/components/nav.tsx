"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { lock } from "@/lib/auth-actions";

const ITEMS = [
  { href: "/", label: "Home", shape: "diamond" },
  { href: "/games", label: "Games", shape: "square" },
  { href: "/players", label: "Players", shape: "circle" },
  { href: "/stats", label: "Stats", shape: "bar" },
  { href: "/transactions", label: "Ledger", shape: "pill" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Where the top-left back control goes: the parent screen, never just "home". */
function parentOf(pathname: string) {
  if (pathname === "/") return "/groups";
  if (pathname.startsWith("/stats")) return "/";
  // Transactions have no detail screen, so an edit goes straight back to the ledger.
  if (pathname.startsWith("/transactions/")) return "/transactions";
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}

/** Secondary line under the title, mirroring the design: context, not repetition. */
function subtitleFor(pathname: string, group: NavGroup | null) {
  if (!group) return "Poker nights together";
  if (pathname === "/games") return `${group.games} ${group.games === 1 ? "night" : "nights"}`;
  if (pathname === "/transactions" || pathname === "/stats") return "All time";
  return group.name;
}

function titleFor(pathname: string) {
  if (pathname === "/") return "Your Table";
  if (pathname === "/pulse") return "League Pulse";
  if (pathname.startsWith("/groups")) return "Groups";
  if (pathname.startsWith("/games/")) return "Game Night";
  if (pathname.startsWith("/games")) return "Games";
  if (pathname.startsWith("/players/")) return "Player";
  if (pathname.startsWith("/players")) return "Players";
  if (pathname.startsWith("/stats")) return "Stats";
  if (pathname.startsWith("/transactions")) return "Ledger";
  return "PKRTrackr";
}

type NavGroup = { id: string; name: string; accent: string; games: number; members: number };

export function Nav({ activeGroup, canLock = false }: { activeGroup: NavGroup | null; canLock?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="app-topbar">
        <Link href={parentOf(pathname)} onClick={closeMenu} className="topbar-control" aria-label={pathname === "/" ? "Manage groups" : "Back"}>
          <Icon name={pathname === "/" ? "sparkles" : "back"} />
        </Link>
        <Link href="/groups" onClick={closeMenu} className="min-w-0 flex-1 text-center" title={activeGroup ? `${activeGroup.name} · Manage groups` : "Create a group"}>
          <div className="truncate text-[18px] font-extrabold tracking-[-0.2px]">{titleFor(pathname)}</div>
          <div className="topbar-subtitle">{subtitleFor(pathname, activeGroup)}</div>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="topbar-control topbar-add"
          aria-label={menuOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={menuOpen}
          aria-controls="quick-actions"
        >
          <Icon name={menuOpen ? "close" : "plus"} />
        </button>
        {menuOpen ? <div id="quick-actions" className="quick-actions" onKeyDown={(event) => { if (event.key === "Escape") closeMenu(); }}>
          {activeGroup ? <><span className="eyebrow">{activeGroup.name}</span><Link href="/games/new" onClick={closeMenu}>Start a night <span>↗</span></Link><Link href="/players/new" onClick={closeMenu}>Add a player <span>↗</span></Link><Link href="/transactions/new" onClick={closeMenu}>Record payment <span>↗</span></Link></> : null}
          <Link href="/groups" onClick={closeMenu}>Manage groups <span>↗</span></Link>
          {canLock ? <form action={lock}><button type="submit" className="quick-action-lock">Lock app <span>→</span></button></form> : null}
        </div> : null}
      </header>

      <nav className="app-bottom-nav" aria-label="Main navigation">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined} className={`bottom-nav-item ${active ? "bottom-nav-active" : ""}`}>
              <Icon name={({ diamond: "home", square: "cards", circle: "players", bar: "stats", pill: "ledger" } as Record<string, IconName>)[item.shape]} size={23} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
