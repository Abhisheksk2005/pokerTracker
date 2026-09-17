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
export function GameBankForms({ context, players, defaultBuyIn, recent = [] }: { context: BankContext; players: Player[]; defaultBuyIn: number; recent?: { playerId: string; amount: number; at: number }[] }) {
  const [tab, setTab] = useState("BUY_IN");
  const [lender, setLender] = useState(players[0]?.id ?? "");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState(String(defaultBuyIn / 100));

  // Warn about an identical buy-in for the same player in the last few minutes:
  // double entry is the easiest mistake to make at a busy table. The clock is read
  // in the change handler, never during render.
  const [duplicate, setDuplicate] = useState<{ name: string; minutesAgo: number } | null>(null);
  const checkDuplicate = (takerId: string, value: string) => {
    const cents = Math.round(Number(value) * 100);
    const match = recent.find((row) => row.playerId === takerId && row.amount === cents && Date.now() - row.at <= 5 * 60000);
    setDuplicate(match ? { name: players.find((player) => player.id === takerId)?.name ?? "This player", minutesAgo: Math.round((Date.now() - match.at) / 60000) } : null);
  };

  const help =
    tab === "BUY_IN"
      ? "Chips from the bank box. Nobody pays now - settle at the end."
      : tab === "LEND"
        ? "One player hands their chips to another. No cash moves."
        : "Count the chips the player is leaving with.";

  return <section className="bank-controls"><nav className="bank-tabs" aria-label="Game actions">{[["BUY_IN", "+ Buy-in"], ["LEND", "Lend chips"], ["CASH_OUT", "Final chips"]].map(([value, label]) => <button type="button" aria-pressed={tab === value} key={value} className={tab === value ? "selected" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
    <ActionForm key={tab} action={bankAction} className="bank-control-form"><BankFields context={context} action={tab === "LEND" ? "RECYCLE" : tab} />
      <p className="section-caption">{help}</p>
      <label className="label" htmlFor="bank-player">{tab === "LEND" ? "Chips from" : tab === "CASH_OUT" ? "Player leaving" : "Player"}</label>
      <select id="bank-player" name="playerId" className="field" value={lender} onChange={(event) => { setLender(event.target.value); if (recipient === event.target.value) setRecipient(""); checkDuplicate(tab === "LEND" ? recipient : event.target.value, amount); }}>{players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select>
      {tab === "LEND" ? <><label className="label" htmlFor="chip-recipient">Chips to</label><select id="chip-recipient" name="recipientId" className="field" required value={recipient} onChange={(event) => { setRecipient(event.target.value); checkDuplicate(event.target.value, amount); }}><option value="">Choose a player…</option>{players.filter((player) => player.id !== lender).map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}<option value="">— or back into the bank box —</option></select></> : null}
      <label className="label" htmlFor="bank-amount">{tab === "CASH_OUT" ? "Chips counted" : "Chip value"} (₹ INR)</label>
      <input id="bank-amount" name="amount" type="number" min="0.01" step="0.01" required className="field amount-field" value={amount} onChange={(event) => { setAmount(event.target.value); checkDuplicate(tab === "LEND" ? recipient : lender, event.target.value); }} />
      {duplicate ? <p className="bank-duplicate">⚠ {duplicate.name} already took ₹{Number(amount).toLocaleString("en-IN")} {duplicate.minutesAgo < 1 ? "less than a minute" : `${duplicate.minutesAgo} min`} ago. Add another?</p> : null}
      <SubmitButton className="btn btn-primary w-full">{tab === "BUY_IN" ? "Give chips" : tab === "LEND" ? "Move chips" : "Record final chips"}</SubmitButton>
    </ActionForm>
  </section>;
}
export function LateSeatForm({ context, players, defaultBuyIn }: { context: BankContext; players: Player[]; defaultBuyIn: number }) {
  const [saved, setSaved] = useState("");
  return <ActionForm action={bankAction} className="bank-control-form"><BankFields context={context} action="SEAT" /><label className="label" htmlFor="late-player">Saved player</label><select id="late-player" name="playerId" className="field" value={saved} onChange={(event) => setSaved(event.target.value)}><option value="">Add a new player</option>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{!saved ? <><label className="label" htmlFor="late-name">New player name</label><input id="late-name" name="playerName" className="field" required maxLength={80} /></> : null}<label className="label" htmlFor="late-initial">Initial buy-in (₹ INR)</label><input id="late-initial" name="amount" className="field" type="number" step="0.01" min="0.01" defaultValue={defaultBuyIn / 100} required /><p className="section-caption">Nobody pays now. Every buy-in is settled after the game.</p><SubmitButton>Save member & add to game</SubmitButton></ActionForm>;
}
