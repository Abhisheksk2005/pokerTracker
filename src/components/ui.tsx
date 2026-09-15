import Link from "next/link";
import type { ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/money";
import { Icon, type IconName } from "@/components/icons";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card-header flex items-start justify-between gap-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[19px] font-black tracking-[-0.035em]">
          {icon}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[var(--text-dim)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="page-header mb-6">
      <div>
        {eyebrow ? <div className="eyebrow page-eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="text-[34px] leading-[1.05] font-black tracking-[-0.035em]">{title}</h1>
        {subtitle ? <p className="mt-2 text-[13px] leading-5 font-semibold text-[var(--text-dim)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="mt-4 flex flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "up" | "down" | "violet";
  icon?: IconName;
}) {
  const color =
    tone === "up" ? "text-[var(--up)]" : tone === "down" ? "text-[var(--down)]" : tone === "violet" ? "text-[var(--violet)]" : "";
  return (
    <div className={`card stat-tile stat-tone-${tone} px-[15px] py-[14px]`}>
      <div className="eyebrow stat-label">{icon ? <Icon name={icon} size={14} /> : null}{label}</div>
      <div className={`stat-tile-value tabular mt-2 text-[24px] font-black tracking-[-0.035em] ${color}`}>{value}</div>
      {hint ? <div className="stat-tile-hint mt-0.5 text-[12.5px] font-semibold">{hint}</div> : null}
    </div>
  );
}

/** Signed money with profit/loss colouring. */
export function Money({
  cents,
  signed = false,
  bold = false,
}: {
  cents: number;
  signed?: boolean;
  bold?: boolean;
}) {
  const tone =
    !signed || cents === 0
      ? ""
      : cents > 0
        ? "text-[var(--up)]"
        : "text-[var(--down)]";
  return (
    <span className={`tabular ${tone} ${bold ? "font-semibold" : ""}`}>
      {fmtMoney(cents, { sign: signed })}
    </span>
  );
}

export function Pct({ value, signed = false }: { value: number | null; signed?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-[var(--text-faint)]">—</span>;
  const tone = !signed || value === 0 ? "" : value > 0 ? "text-[var(--up)]" : "text-[var(--down)]";
  return <span className={`tabular ${tone}`}>{fmtPct(value)}</span>;
}

export function StreakChip({ type, length }: { type: "W" | "L" | null; length: number }) {
  if (!type || length === 0) return <span className="text-[var(--text-faint)]">—</span>;
  return (
    <span className={`chip ${type === "W" ? "chip-up" : "chip-down"}`}>
      {length}
      {type}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`chip ${status === "CLOSED" ? "" : "chip-accent"}`}>
      {status === "CLOSED" ? "CLOSED" : "OPEN"}
    </span>
  );
}

export function PlayerLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/players/${id}`} className="link">
      {name}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-[var(--text-dim)]">{children}</div>
  );
}

export function Tabs({
  items,
  current,
}: {
  items: { href: string; label: ReactNode; key: string }[];
  current: string;
}) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b">
      {items.map((it) => {
        const active = it.key === current;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal diverging bar used for profit distribution. */
export function DivergingBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const positive = value >= 0;
  return (
    <div className="flex h-3 w-full items-center">
      <div className="flex h-full w-1/2 justify-end">
        {!positive ? (
          <div
            className="h-full rounded-l-sm bg-[var(--down)]"
            style={{ width: `${pct}%` }}
          />
        ) : null}
      </div>
      <div className="h-full w-px bg-[var(--border-strong)]" />
      <div className="flex h-full w-1/2">
        {positive ? (
          <div className="h-full rounded-r-sm bg-[var(--up)]" style={{ width: `${pct}%` }} />
        ) : null}
      </div>
    </div>
  );
}
