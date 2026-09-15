"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { Avatar } from "@/components/poker-ui";
import { startGame } from "@/lib/bank-actions";
import { bankAmount } from "@/lib/bank";
import { suggestGameName, toDateInput } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";

type PlayerOption = { id: string; name: string; inGroup: boolean; active: boolean };
type Seat = { key: string; playerId?: string; name: string; amount: string; paid: boolean };

export function GameSetupWizard({ groupId, groupName, players, requestId }: { groupId: string; groupName: string; players: PlayerOption[]; requestId: string }) {
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [initial, setInitial] = useState("20");
  const [seats, setSeats] = useState<Seat[]>(() => players.filter((p) => p.inGroup && p.active).map((p) => ({ key: p.id, playerId: p.id, name: p.name, amount: "20", paid: false })));
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [name, setName] = useState(() => suggestGameName(new Date()));
  const visible = players.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));
  const total = seats.reduce((sum, seat) => { try { return sum + bankAmount(seat.amount); } catch { return sum; } }, 0);
  function toggle(player: PlayerOption) {
    setSeats((current) => current.some((seat) => seat.playerId === player.id) ? current.filter((seat) => seat.playerId !== player.id) : [...current, { key: player.id, playerId: player.id, name: player.name, amount: initial, paid: false }]);
    setError("");
  }
  function addName() {
    const trimmed = newName.trim();
    if (!trimmed) { setError("Enter the new player's name."); return; }
    if (seats.some((seat) => seat.name.toLowerCase() === trimmed.toLowerCase())) { setError("That player is already selected."); return; }
    const saved = players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    setSeats((current) => [...current, { key: saved?.id ?? crypto.randomUUID(), playerId: saved?.id, name: saved?.name ?? trimmed, amount: initial, paid: false }]);
    setNewName(""); setError("");
  }
  function updateSeat(key: string, patch: Partial<Seat>) { setSeats((current) => current.map((seat) => seat.key === key ? { ...seat, ...patch } : seat)); }

  return <div className="setup-wizard">
    <div className="setup-steps"><span className={step === 1 ? "current" : "done"}>1 · Members</span><span className={step === 2 ? "current" : ""}>2 · Initial buy-ins</span></div>
    <div className="eyebrow mt-5">{groupName}</div><h2 className="mt-2 text-[26px] font-black tracking-tight">{step === 1 ? "Who's at the table?" : "Set the opening stacks."}</h2>
    <p className="section-caption">{step === 1 ? "Choose saved players or add someone new. New profiles and group memberships are saved when you start." : "Initial buy-ins stay locked. Additional buy-ins can be cleared during play."}</p>
    {error ? <p role="alert" className="mt-3 text-sm text-[var(--down)]">{error}</p> : null}
    {step === 1 ? <>
      <label className="label mt-5" htmlFor="roster-search">Previously saved players</label>
      <input id="roster-search" className="field" placeholder="Search all saved players" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="setup-roster">{visible.map((player) => {
        const selected = seats.some((seat) => seat.playerId === player.id);
        return <button type="button" key={player.id} aria-pressed={selected} className={`setup-player ${selected ? "selected" : ""}`} onClick={() => toggle(player)}><Avatar name={player.name} /><span><strong>{player.name}</strong><small>{player.inGroup ? "In this group" : "Saved player · add to group"}</small></span><b aria-hidden="true">{selected ? "✓" : "+"}</b></button>;
      })}{!visible.length ? <p className="section-caption py-4">No saved players match. Add a new name below.</p> : null}</div>
      <div className="new-member-card"><label htmlFor="new-member" className="label">Add a new member</label><div className="flex gap-2"><input id="new-member" maxLength={80} className="field" placeholder="Player name" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addName(); } }} /><button className="btn btn-primary" type="button" onClick={addName}>Add</button></div>
        {seats.filter((seat) => !seat.playerId).map((seat) => <div className="mt-3 flex items-center justify-between gap-2 text-sm" key={seat.key}><span>{seat.name} <span className="text-[var(--accent)]">· new</span></span><button type="button" className="btn btn-sm" aria-label={`Remove ${seat.name} from selection`} onClick={() => setSeats((current) => current.filter((item) => item.key !== seat.key))}>Remove</button></div>)}
      </div>
      <button type="button" className="btn btn-primary start-game-button" onClick={() => { if (!seats.length) setError("Choose at least one player."); else { setError(""); setStep(2); } }}>Set buy-ins <span>{seats.length} players →</span></button>
    </> : <ActionForm action={startGame} className="mt-5 space-y-4">
      <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="seats" value={JSON.stringify(seats.map((seat) => ({ playerId: seat.playerId, name: seat.name, amount: seat.amount, paid: seat.paid })))} />
      <div className="initial-amount-card"><label htmlFor="initial-amount" className="label">Initial buy-in per player (₹ INR)</label><input id="initial-amount" name="defaultBuyIn" type="number" min="0.01" step="0.01" required className="field amount-field" value={initial} onChange={(e) => { setInitial(e.target.value); setSeats((current) => current.map((seat) => ({ ...seat, amount: e.target.value }))); }} /><p className="mt-2 text-xs text-[var(--text-dim)]">Set a common amount here, or adjust individual amounts below before starting.</p></div>
      <div className="setup-buyins">{seats.map((seat) => <div className="setup-buyin" key={seat.key}><div className="flex items-center gap-2"><Avatar name={seat.name} /><strong>{seat.name}</strong></div><label className="sr-only" htmlFor={`amount-${seat.key}`}>Initial buy-in for {seat.name}</label><input id={`amount-${seat.key}`} className="field" type="number" min="0.01" step="0.01" required value={seat.amount} onChange={(e) => updateSeat(seat.key, { amount: e.target.value })} /><label className="setup-paid"><input type="checkbox" checked={seat.paid} onChange={(e) => updateSeat(seat.key, { paid: e.target.checked })} /> Initial cash already collected</label></div>)}</div>
      <p className="text-xs leading-5 text-[var(--text-dim)]">Unchecked initial payments remain due until final settlement. During the game, only extra buy-ins have a Clear button.</p>
      <div className="card p-4 space-y-4"><div><label htmlFor="game-name" className="label">Game name</label><input id="game-name" name="name" className="field" maxLength={120} required value={name} onChange={(e) => setName(e.target.value)} /></div><div><label htmlFor="game-date" className="label">Date</label><input id="game-date" name="date" className="field" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div></div>
      <details className="card p-4"><summary className="text-sm font-bold cursor-pointer">Chip supply & bank cash (optional)</summary><div className="mt-4 space-y-4"><div><label className="label" htmlFor="chip-supply">Total physical chip value (₹ INR)</label><input id="chip-supply" name="chipBankSize" type="number" min="0.01" step="0.01" className="field" placeholder="Leave blank if not counted" /><p className="section-caption">Count the value of all physical chips, including opening stacks. This lets the bank warn you before chips run out.</p></div><div><label className="label" htmlFor="opening-cash">Extra cash already in the bank (₹ INR)</label><input id="opening-cash" name="openingCash" type="number" min="0" step="0.01" className="field" defaultValue="0" /><p className="section-caption">Exclude initial payments checked above; those are counted automatically.</p></div></div></details>
      <div className="setup-total"><span>{seats.length} players · opening pot</span><strong>{fmtMoney(total)}</strong></div>
      <SubmitButton className="btn btn-primary start-game-button" pendingLabel="Saving players & starting…">Start game →</SubmitButton>
      <button type="button" className="btn w-full" onClick={() => setStep(1)}>← Back to members</button>
    </ActionForm>}
  </div>;
}
