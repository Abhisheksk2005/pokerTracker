import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { ConfirmButton } from "@/components/form";
import { Avatar, SectionTitle } from "@/components/poker-ui";
import { Card, CardHeader, Empty, Money, PlayerLink, StatTile } from "@/components/ui";
import { deleteTransaction } from "@/lib/actions";
import { fmtDate, fmtDayHeading, parseDateInput } from "@/lib/dates";
import { balancesByPlayer, getTransactions, groupByDay, isTxType, ledgerTotals, TX_META, TX_TYPES, withRunningBalance, type TxType } from "@/lib/ledger";
import { fmtMoney } from "@/lib/money";
import { getPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";
const DAYS_PER_PAGE = 8;
const TX_ICON: Record<TxType, IconName> = { BUY_IN: "up", CASH_OUT: "down", PAYMENT_IN: "right", PAYMENT_OUT: "back", ADJUSTMENT: "adjust" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ playerId?: string; from?: string; to?: string; type?: string; page?: string }> }) {
  const sp = await searchParams;
  const playerId = sp.playerId || undefined;
  const type: TxType | undefined = sp.type && isTxType(sp.type) ? sp.type : undefined;
  const from = sp.from ? parseDateInput(sp.from) : undefined;
  const to = sp.to ? endOfDay(parseDateInput(sp.to)) : undefined;
  const [rows, players] = await Promise.all([getTransactions({ playerId, type, from, to }), getPlayers()]);
  const totals = ledgerTotals(rows);
  const allDays = groupByDay(rows);
  const balances = balancesByPlayer(rows);
  const focusPlayer = playerId ? players.find((p) => p.id === playerId) : undefined;
  const pageCount = Math.max(1, Math.ceil(allDays.length / DAYS_PER_PAGE));
  const page = Math.min(Math.max(1, Math.floor(Number(sp.page) || 1)), pageCount);
  const days = allDays.slice((page - 1) * DAYS_PER_PAGE, page * DAYS_PER_PAGE);
  const pageLink = (n: number, filter = type) => {
    const params = new URLSearchParams();
    if (playerId) params.set("playerId", playerId);
    if (filter) params.set("type", filter);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    if (n > 1) params.set("page", String(n));
    return `/transactions${params.size ? `?${params}` : ""}`;
  };
  const runningById = new Map<string, number>();
  if (playerId) for (const row of withRunningBalance(rows)) runningById.set(row.id, row.balance);

  return <>
    <h1 className="sr-only">{focusPlayer ? `${focusPlayer.name} · ledger` : "Ledger"}</h1>
    <div className="page-toolbar"><span className="eyebrow">{focusPlayer ? <>{focusPlayer.name}<br />Every payment.</> : <>Every night.<br />Every payment.</>}</span><Link href="/transactions/new" className="btn btn-primary"><Icon name="plus" size={16} />Record payment</Link></div>

    <nav className="filter-chips mb-3" aria-label="Transaction type">
      <Link href={(() => { const params = new URLSearchParams(); if (playerId) params.set("playerId", playerId); if (sp.from) params.set("from", sp.from); if (sp.to) params.set("to", sp.to); return `/transactions${params.size ? `?${params}` : ""}`; })()} className={`filter-chip ${!type ? "filter-chip-active" : ""}`} aria-current={!type ? "true" : undefined}><Icon name="list" size={14} />All types</Link>
      {TX_TYPES.map((value) => <Link href={pageLink(1, value)} key={value} className={`filter-chip ${type === value ? "filter-chip-active" : ""}`} aria-current={type === value ? "true" : undefined}><Icon name={TX_ICON[value]} size={14} />{TX_META[value].label}</Link>)}
    </nav>
    <details className="card ledger-filters mb-5" open={Boolean(playerId || sp.from || sp.to)}>
      <summary><Icon name="filter" size={18} />Filter by player & date{playerId || sp.from || sp.to ? " · active" : ""}</summary>
      <form className="grid grid-cols-2 gap-3 pt-4">
        {type ? <input type="hidden" name="type" value={type} /> : null}
        <div className="col-span-2"><label htmlFor="ledger-player" className="label">Player</label><select id="ledger-player" name="playerId" className="field" defaultValue={playerId ?? ""}><option value="">All players</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label htmlFor="ledger-from" className="label">From</label><input id="ledger-from" type="date" name="from" className="field" defaultValue={sp.from ?? ""} /></div>
        <div><label htmlFor="ledger-to" className="label">To</label><input id="ledger-to" type="date" name="to" className="field" defaultValue={sp.to ?? ""} /></div>
        <div className="col-span-2 flex gap-2"><button type="submit" className="btn btn-primary">Apply</button><Link href="/transactions" className="btn">Reset</Link></div>
      </form>
    </details>
    <div className="mb-5 grid grid-cols-2 gap-[10px]">
      <StatTile icon="in" label="Cash in" value={fmtMoney(totals.moneyIn)} hint="Collected from players" />
      <StatTile icon="out" label="Cash out" value={fmtMoney(totals.moneyOut)} hint="Paid to players" />
      <StatTile icon="trend" label="Net position" value={fmtMoney(totals.net, { sign: true })} tone={totals.net >= 0 ? "up" : "down"} hint={totals.net >= 0 ? "Players are up overall" : "Bank is holding cash"} />
      <StatTile icon="ledger" label="Transactions" value={totals.count} hint={`Across ${allDays.length} ${allDays.length === 1 ? "day" : "days"}`} />
    </div>
    <div className="flex flex-col gap-5">
      {!days.length ? <Card><Empty><span className="empty-icon empty-icon-coral"><Icon name="ledger" size={28} /></span><p className="empty-title mb-4">No transactions match these filters.</p><Link href="/transactions/new" className="btn btn-primary"><Icon name="plus" size={16} />Record the first one</Link></Empty></Card> : days.map((day) => <section className="ledger-day" key={day.key}>
        <h2>{fmtDayHeading(day.date)}</h2><p className="mono mt-1 text-[10px] leading-5 text-[var(--text-faint)]">{day.rows.length} entries · in {fmtMoney(day.moneyIn)} · out {fmtMoney(day.moneyOut)} · net {fmtMoney(day.net, { sign: true })}</p>
        <div className="ledger-entries">{day.rows.map((row) => <details className="ledger-entry" key={row.id}>
          <summary><Avatar name={row.player.name} /><span className="row-main"><strong>{row.player.name}</strong><span style={{ color: TX_META[row.type as TxType]?.tone === "in" ? "var(--accent)" : "var(--violet)" }}>{TX_META[row.type as TxType]?.label ?? row.type}</span></span><span className="ledger-entry-amount"><Money cents={row.amount} signed /></span></summary>
          <div className="ledger-entry-details">
            <p><PlayerLink id={row.playerId} name="Player profile" /></p>
            <p>{row.game ? <Link href={`/games/${row.game.id}`} className="link">{row.game.name}</Link> : "Manual transaction"}</p>
            {row.note ? <p>{row.note}</p> : null}
            <p>Method: {row.method ?? "Not specified"}</p>
            {playerId ? <p>Running balance: {fmtMoney(runningById.get(row.id) ?? 0, { sign: true })}</p> : null}
            {row.operationId ? <p className="text-[var(--violet)]">Managed in the game bank · correct it from Bank activity.</p> : <div className="mt-3 flex gap-2"><Link href={`/transactions/${row.id}/edit`} className="btn btn-sm">Edit</Link><form action={deleteTransaction}><input type="hidden" name="id" value={row.id} /><ConfirmButton message="Delete this transaction?">Delete</ConfirmButton></form></div>}
          </div>
        </details>)}</div>
      </section>)}
      {pageCount > 1 ? <div className="flex items-center justify-between"><Link href={pageLink(Math.max(1, page - 1))} className={`btn btn-sm ${page === 1 ? "pointer-events-none opacity-40" : ""}`} aria-disabled={page === 1}>Previous</Link><span className="text-xs text-[var(--text-dim)]">Page {page} of {pageCount}</span><Link href={pageLink(Math.min(pageCount, page + 1))} className={`btn btn-sm ${page === pageCount ? "pointer-events-none opacity-40" : ""}`} aria-disabled={page === pageCount}>Next</Link></div> : null}
    </div>
    <section className="pulse-section"><SectionTitle>Balances</SectionTitle><p className="section-caption">Positive means the player has taken out more than they put in.</p>
      {!balances.length ? <p className="section-empty">Nothing to balance yet.</p> : <div className="leaderboard">{[...balances].sort((a, b) => b.balance - a.balance).map((balance) => <Link href={`/transactions?playerId=${balance.playerId}`} className="leaderboard-row" key={balance.playerId}><Avatar name={balance.playerName} /><span className="row-main"><strong>{balance.playerName}</strong><span>In {fmtMoney(balance.moneyIn)} · out {fmtMoney(balance.moneyOut)}{balance.lastDate ? ` · ${fmtDate(balance.lastDate)}` : ""}</span></span><span className="row-result"><strong><Money cents={balance.balance} signed /></strong><span>Balance</span></span></Link>)}</div>}
    </section>
    <details className="card ledger-filters mb-4"><summary>What is the ledger?</summary><div className="space-y-3 pt-3 text-xs leading-5 text-[var(--text-dim)]"><p>Your group’s payment history in Indian rupees. Cash in is money collected from players; cash out is money paid to players. Each entry shows the player, date, amount and payment method.</p><p>Player balances show money received minus money paid. For example, paying ₹500 and receiving ₹800 gives a +₹300 balance. This is the recorded money flow; outstanding debts appear in the game bank.</p><p>Clearing a buy-in or paying a player in the live game adds a ledger entry automatically. Recycled chips create a bank debt, and enter the ledger when money is paid. Initial buy-ins stay locked during play.</p><p>Use Record payment for separate payments. To settle a live game, use its bank controls so the debt and payment stay linked; do not record the same payment twice.</p></div></details>
    <Card className="mt-5"><CardHeader title="How this ledger works" /><ul className="space-y-3 px-4 pb-4 text-sm text-[var(--text-dim)]">{TX_TYPES.map((value) => <li key={value}><strong className="text-[var(--text)]">{TX_META[value].label}</strong><p className="mt-1 text-xs leading-5">{TX_META[value].help}</p></li>)}<li className="border-t pt-3 text-xs leading-5">A player&apos;s balance should match their all-time profit once everyone has settled up. Their profile flags it when the two disagree.</li></ul></Card>
  </>;
}
function endOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999); }
