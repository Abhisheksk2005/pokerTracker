import Link from "next/link";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Avatar, SectionTitle } from "@/components/poker-ui";
import { StatTile } from "@/components/ui";
import { BankFields, GameBankForms, LateSeatForm, LiveRefresh } from "@/components/game-bank-forms";
import { bankAction } from "@/lib/bank-actions";
import { BANK_LABELS, bankSummary, isCharge, type BankKind } from "@/lib/bank";
import { fmtMoney } from "@/lib/money";
import { fmtDateLong } from "@/lib/dates";
import type { getGame } from "@/lib/queries";

type Game = NonNullable<Awaited<ReturnType<typeof getGame>>>;
export function EnableLiveBank({ game }: { game: Game }) {
  return <section className="bank-notice mb-5"><div className="eyebrow">New · live game bank</div><h2>Keep chips and cash in sync.</h2><p>Track extra buy-ins, payments and chips lent to the bank. Existing buy-in totals become locked opening amounts, including any earlier rebuys. Existing payments are carried forward.</p><ActionForm action={bankAction}><BankFields context={{ gameId: game.id, groupId: game.groupId!, version: game.bankVersion }} action="ENABLE" /><label htmlFor="legacy-float" className="label">Extra opening bank cash (₹ INR)</label><input id="legacy-float" name="openingCash" className="field mb-3" type="number" min="0" step="0.01" defaultValue="0" /><p className="section-caption mb-3">Only add cash outside recorded player payments.</p><SubmitButton>Use live bank for this game</SubmitButton></ActionForm></section>;
}

export function LiveGame({ game, allPlayers }: { game: Game; allPlayers: { id: string; name: string }[] }) {
  const bank = bankSummary(game.bankOperations, game.chipBankSize, game.openingCash);
  const context = { gameId: game.id, groupId: game.groupId!, version: game.bankVersion };
  const open = game.status === "ACTIVE";
  const seated = game.entries.map((entry) => ({ id: entry.playerId, name: entry.player.name }));
  // Recent chip hand-outs, for the duplicate warning in the buy-in form.
  const recentTakes = game.bankOperations
    .filter((row) => !row.voidedAt && (row.kind === "BUY_IN" || row.kind === "INITIAL_BUY_IN"))
    .map((row) => ({ playerId: row.playerId, amount: row.amount, at: row.createdAt.getTime() }));
  const batches = new Map<string, typeof game.bankOperations>();
  for (const row of game.bankOperations) batches.set(row.batchId, [...(batches.get(row.batchId) ?? []), row]);
  return <div className="live-bank-page"><LiveRefresh />
    <header className="pulse-heading"><div className="flex justify-between items-center"><span className="live-badge">{open ? "● LIVE GAME" : "✓ GAME FINISHED"}</span><Link href="/" className="link text-xs">Your group →</Link></div><h1>{game.name}</h1><p className="section-caption">{fmtDateLong(game.date)} · {seated.length} players</p></header>
    {open
      ? <><div className="pulse-kpis bank-kpis"><StatTile label="Chips at the table" value={fmtMoney(bank.chipsInPlay)} hint="Still in front of players" /><StatTile label="Chips in the box" value={bank.chipsAvailable === null ? "Not counted" : fmtMoney(bank.chipsAvailable)} hint="Left to hand out" tone={bank.chipsAvailable !== null && bank.chipsAvailable <= 0 ? "down" : "neutral"} /><StatTile label="Given out" value={fmtMoney(bank.totalBuyIn)} hint={`${seated.length} players`} /></div>
        {bank.chipsAvailable !== null && bank.chipsAvailable <= 0 ? <p className="table-check table-check-warn">Bank box is empty. Use <strong>Lend chips</strong> to move chips from a player who is ahead.</p> : null}</>
      : <div className="pulse-kpis bank-kpis"><StatTile label="Bank cash" value={fmtMoney(bank.bankCash)} hint="Cash actually held" /><StatTile label="Chips at the table" value={fmtMoney(bank.chipsInPlay)} hint="Should be zero" tone={bank.chipsInPlay ? "down" : "up"} /><StatTile label="Bank owes players" value={fmtMoney(bank.owedToPlayers)} hint="Returns awaiting payment" tone={bank.owedToPlayers ? "down" : "neutral"} /><StatTile label="Players owe bank" value={fmtMoney(bank.owedToBank)} hint="Buy-ins still unpaid" /></div>}
    {open ? <GameBankForms context={context} players={seated} defaultBuyIn={game.defaultBuyIn} recent={recentTakes} /> : <div className="bank-notice"><h2>Time to settle up.</h2><p>All chips are returned. Final settlement below offsets each player’s buy-ins against their returns and records only the cash difference.</p></div>}
    <section className="pulse-section"><SectionTitle tone="violet">{open ? "Players & chips" : "Players & settlement"}</SectionTitle><p className="section-caption">{open ? "Nobody pays during the game. Every buy-in is settled once the night ends." : "Each player’s buy-ins are offset against their chips; only the difference is cash."}</p>
    <div className="bank-player-list">{game.entries.map((entry) => {
      const player = bank.players.find((item) => item.playerId === entry.playerId) ?? { buyIn: 0, cashOut: 0, adjustment: 0, owesBank: 0, bankOwes: 0 };
      const dues = bank.dues.filter((due) => due.playerId === entry.playerId);
      const eligible = dues.filter((due) => due.remaining > 0 && (!open || due.kind !== "INITIAL_BUY_IN"));
      const net = eligible.reduce((sum, due) => sum + (isCharge(due.kind) ? -due.remaining : due.remaining), 0);
      return <article className="bank-player-card" key={entry.id}><header><Avatar name={entry.player.name} /><div><h3>{entry.player.name}</h3><p>{open ? <>Chips taken {fmtMoney(player.buyIn)} · handed back {fmtMoney(player.cashOut)}</> : <>Buy-ins {fmtMoney(player.buyIn)} · chips {fmtMoney(player.cashOut)}</>}</p></div></header>
        {open
          ? <div className="player-bank-balances"><div><small>In for</small><strong>{fmtMoney(player.buyIn - player.cashOut)}</strong></div><div><small>Chips handed to others</small><strong className={player.cashOut ? "text-[var(--violet)]" : ""}>{fmtMoney(player.cashOut)}</strong></div></div>
          : <div className="player-bank-balances"><div><small>Player owes bank</small><strong>{fmtMoney(player.owesBank)}</strong></div><div><small>Bank owes player</small><strong className={player.bankOwes ? "text-[var(--violet)]" : ""}>{fmtMoney(player.bankOwes)}</strong></div></div>}
        {!open ? <div className="bank-dues">{dues.map((due) => <div className={`bank-due ${due.kind === "INITIAL_BUY_IN" ? "locked-due" : ""}`} key={due.id}><div className="flex justify-between gap-3"><strong>{BANK_LABELS[due.kind as BankKind]}{due.kind === "INITIAL_BUY_IN" ? " · Locked" : ""}</strong><span className="mono">{fmtMoney(due.amount)}</span></div><p>{due.remaining ? `${fmtMoney(due.remaining)} ${isCharge(due.kind) ? "unpaid" : "owed to player"}${due.kind === "INITIAL_BUY_IN" ? " · final settlement only" : ""}` : "Settled"}{due.paid > 0 && due.remaining > 0 ? ` · ${fmtMoney(due.paid)} settled` : ""}</p>
          {due.remaining > 0 && due.kind !== "INITIAL_BUY_IN" ? <details className="clear-payment"><summary>{isCharge(due.kind) ? "Clear buy-in" : "Record bank payment"} →</summary><ActionForm action={bankAction} className="mt-3"><BankFields context={context} action="CLEAR" /><input type="hidden" name="operationId" value={due.id} /><label className="label" htmlFor={`clear-${due.id}`}>Cash {isCharge(due.kind) ? "received" : "paid"} (₹ INR)</label><div className="flex gap-2"><input id={`clear-${due.id}`} name="amount" className="field" type="number" min="0.01" max={due.remaining / 100} step="0.01" required defaultValue={due.remaining / 100} /><SubmitButton className="btn btn-sm btn-primary">{isCharge(due.kind) ? "Clear" : "Record paid"}</SubmitButton></div></ActionForm></details> : null}
        </div>)}</div> : null}
        {!open && eligible.length ? <div className="net-settlement"><p>Final settlement: {net > 0 ? `bank pays ${fmtMoney(net)}` : net < 0 ? `collect ${fmtMoney(-net)}` : "no cash needed"}.</p><ActionForm action={bankAction}><BankFields context={context} action="SETTLE" /><input type="hidden" name="playerId" value={entry.playerId} /><SubmitButton className="btn btn-sm w-full">{net ? "Record settlement" : "Offset credit against buy-ins"}</SubmitButton></ActionForm></div> : null}
        {!open ? <p className="final-profit">Game profit <strong style={{ color: player.cashOut + player.adjustment - player.buyIn >= 0 ? "var(--up)" : "var(--down)" }}>{fmtMoney(player.cashOut + player.adjustment - player.buyIn, { sign: true })}</strong></p> : null}
      </article>;
    })}</div></section>
    {open ? <details className="card bank-details"><summary>+ Add another member</summary><LateSeatForm context={context} players={allPlayers.filter((player) => !seated.some((seat) => seat.id === player.id))} defaultBuyIn={game.defaultBuyIn} /></details> : null}
    <section className="pulse-section"><SectionTitle>Bank activity</SectionTitle><p className="section-caption">Linked chip movements stay together. Corrections remain in the history.</p><div className="bank-activity">{[...batches.entries()].reverse().map(([batchId, rows]) => <details className={`activity-batch ${rows[0].voidedAt ? "voided" : ""}`} key={batchId}><summary><span>{rows[0].player.name} · {BANK_LABELS[rows[0].kind as BankKind]}{rows[0].voidedAt ? " · Undone" : ""}</span><strong>{fmtMoney(rows[0].amount)}</strong></summary><div className="activity-body">{rows.map((row) => <p key={row.id}>{row.player.name} · {BANK_LABELS[row.kind as BankKind]} <b>{fmtMoney(row.amount)}</b>{row.note ? <small>{row.note}</small> : null}</p>)}<p className="section-caption">{rows[0].createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>{open && !rows[0].voidedAt && !rows.some((row) => row.kind === "INITIAL_BUY_IN") ? <ActionForm action={bankAction}><BankFields context={context} action="UNDO" /><input type="hidden" name="batchId" value={batchId} /><ConfirmButton message="Undo this entire action and its linked cash records? Later payments must be undone first.">Undo this action</ConfirmButton></ActionForm> : null}</div></details>)}</div></section>
    {open ? <details className="card bank-details"><summary>Physical chip supply</summary><ActionForm action={bankAction} className="bank-control-form"><BankFields context={context} action="CHIPS" /><label htmlFor="supply-update" className="label">Total chip value, including chips in play (₹ INR)</label><input id="supply-update" name="chipBankSize" className="field" type="number" step="0.01" min="0.01" defaultValue={game.chipBankSize === null ? "" : game.chipBankSize / 100} placeholder="Not counted" /><SubmitButton>Update chip supply</SubmitButton></ActionForm></details> : null}
    <div className="bank-finish">{open
      ? bank.chipsInPlay
        ? <p className="table-check table-check-warn">Chips still at the table: <strong>{fmtMoney(bank.chipsInPlay)}</strong>. Record every player’s final chips, then finish. The totals must match before the night can close.</p>
        : <p className="table-check table-check-ok">Balanced. Every chip is accounted for - finish the game to settle up.</p>
      : <p>All chips are in. Settle each player below, then use <strong>Settle up</strong> on the Ledger tab for who pays whom.</p>}
      <ActionForm action={bankAction}><BankFields context={context} action={open ? "CLOSE" : "REOPEN"} /><SubmitButton className="btn w-full">{open ? "Finish game" : "Reopen game"}</SubmitButton></ActionForm></div>
  </div>;
}
