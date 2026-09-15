"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { bankAction } from "@/lib/bank-actions";

export type BankContext = { gameId: string; groupId: string; version: number };
type Player = { id: string; name: string };
export function BankFields({ context, action }: { context: BankContext; action: string }) {
  return <><input type="hidden" name="gameId" value={context.gameId} /><input type="hidden" name="groupId" value={context.groupId} /><input type="hidden" name="version" value={context.version} /><input type="hidden" name="bankAction" value={action} /></>;
}
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === "visible" && !document.activeElement?.closest("form")) router.refresh(); }, 15000); return () => clearInterval(timer); }, [router]);
  return null;
}
export function GameBankForms({ context, players, defaultBuyIn }: { context: BankContext; players: Player[]; defaultBuyIn: number }) {
  const [tab, setTab] = useState("BUY_IN");
  const [lender, setLender] = useState(players[0]?.id ?? "");
  const [recipient, setRecipient] = useState("");
  return <section className="bank-controls"><nav className="bank-tabs" aria-label="Game actions">{[["BUY_IN", "+ Buy-in"], ["CASH_OUT", "Cash-out"], ["RECYCLE", "Recycle chips"]].map(([value, label]) => <button type="button" aria-pressed={tab === value} key={value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
    <ActionForm key={tab} action={bankAction} className="bank-control-form"><BankFields context={context} action={tab} />
      <p className="section-caption">{tab === "BUY_IN" ? "Issue more chips. Unpaid extra buy-ins can be cleared anytime." : tab === "CASH_OUT" ? "Return chips and record whether the player has received cash." : "A returns chips without cash. The bank owes A until paid, even when those chips are given to B."}</p>
      <label className="label" htmlFor="bank-player">{tab === "RECYCLE" ? "Player lending chips to the bank" : "Player"}</label><select id="bank-player" name="playerId" className="field" value={lender} onChange={(event) => { setLender(event.target.value); if (recipient === event.target.value) setRecipient(""); }}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
      {tab === "RECYCLE" ? <><label className="label" htmlFor="chip-recipient">Give these chips to</label><select id="chip-recipient" name="recipientId" className="field" value={recipient} onChange={(event) => setRecipient(event.target.value)}><option value="">Keep chips in the bank</option>{players.filter((player) => player.id !== lender).map((player) => <option key={player.id} value={player.id}>{player.name} · new extra buy-in</option>)}</select></> : null}
      <label className="label" htmlFor="bank-amount">{tab === "BUY_IN" ? "Extra buy-in" : "Chip value"} (₹ INR)</label><input id="bank-amount" name="amount" type="number" min="0.01" step="0.01" required className="field amount-field" defaultValue={defaultBuyIn / 100} />
      {tab !== "RECYCLE" || recipient ? <label className="setup-paid"><input name="paid" type="checkbox" />{tab === "CASH_OUT" ? "Cash has been paid to this player" : tab === "RECYCLE" ? "Recipient has paid cash for the new buy-in" : "Cash has been collected for this buy-in"}</label> : null}
      <SubmitButton className="btn btn-primary w-full">{tab === "BUY_IN" ? "Add buy-in" : tab === "CASH_OUT" ? "Record cash-out" : "Recycle chips & save bank debt"}</SubmitButton>
    </ActionForm>
  </section>;
}
export function LateSeatForm({ context, players, defaultBuyIn }: { context: BankContext; players: Player[]; defaultBuyIn: number }) {
  const [saved, setSaved] = useState("");
  return <ActionForm action={bankAction} className="bank-control-form"><BankFields context={context} action="SEAT" /><label className="label" htmlFor="late-player">Saved player</label><select id="late-player" name="playerId" className="field" value={saved} onChange={(event) => setSaved(event.target.value)}><option value="">Add a new player</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{!saved ? <><label className="label" htmlFor="late-name">New player name</label><input id="late-name" name="playerName" className="field" required maxLength={80} /></> : null}<label className="label" htmlFor="late-initial">Initial buy-in (₹ INR)</label><input id="late-initial" name="amount" className="field" type="number" step="0.01" min="0.01" defaultValue={defaultBuyIn / 100} required /><label className="setup-paid"><input type="checkbox" name="paid" />Initial cash already collected</label><p className="section-caption">This initial buy-in stays locked. Uncollected cash is due at final settlement.</p><SubmitButton>Save member & add to game</SubmitButton></ActionForm>;
}
