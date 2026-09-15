"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type ActionState } from "@/components/form";
import { toDateInput } from "@/lib/dates";
import { TX_META, TX_METHODS, TX_TYPES, type TxType } from "@/lib/ledger-types";
import { fmtMoney, toCents } from "@/lib/money";

export type TxDefaults = {
  id?: string;
  playerId?: string;
  date?: Date;
  type?: TxType;
  amount?: number; // signed cents
  method?: string | null;
  note?: string | null;
};

export function TransactionForm({
  action,
  players,
  defaults = {},
  submitLabel = "Record transaction",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
  players: { id: string; name: string }[];
  defaults?: TxDefaults;
  submitLabel?: string;
}) {
  const [type, setType] = useState<TxType>(defaults.type ?? "BUY_IN");
  const [amount, setAmount] = useState(
    defaults.amount !== undefined ? (Math.abs(defaults.amount) / 100).toString() : "",
  );
  const [sign, setSign] = useState<"1" | "-1">(
    defaults.amount !== undefined && defaults.amount < 0 ? "-1" : "1",
  );

  const meta = TX_META[type];
  const effective =
    meta.direction === 0
      ? (sign === "-1" ? -1 : 1) * Math.abs(toCents(amount))
      : meta.direction * Math.abs(toCents(amount));

  return (
    <ActionForm action={action} className="px-4 py-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Player">
          <select name="playerId" className="field" defaultValue={defaults.playerId ?? ""} required>
            <option value="" disabled>
              Choose a player…
            </option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date">
          <input
            type="date"
            name="date"
            className="field"
            defaultValue={toDateInput(defaults.date ?? new Date())}
            required
          />
        </Field>

        <Field label="Type" hint={meta.help}>
          <select
            name="type"
            className="field"
            value={type}
            onChange={(e) => setType(e.target.value as TxType)}
          >
            {TX_TYPES.map((t) => (
              <option key={t} value={t}>
                {TX_META[t].label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Amount (₹ INR)" hint="Always enter a positive number — the type sets the direction.">
          <input
            name="amount"
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="20"
            required
          />
        </Field>

        <Field label="Method">
          <select name="method" className="field" defaultValue={defaults.method ?? "CASH"}>
            {TX_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        {meta.direction === 0 ? (
          <Field label="Direction" hint="Adjustments can go either way.">
            <div className="flex gap-2">
              {(["-1", "1"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSign(s)}
                  className={`btn flex-1 ${sign === s ? "btn-primary" : ""}`}
                >
                  {s === "-1" ? "Player pays" : "Player receives"}
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <div className="self-end">
            <p className="rounded-lg border bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-dim)]">
              {meta.direction === -1
                ? "Money moves from the player to the bank."
                : "Money moves from the bank to the player."}
            </p>
          </div>
        )}
      </div>

      <input type="hidden" name="sign" value={sign} />

      <div className="mt-4">
        <Field label="Note">
          <input
            name="note"
            className="field"
            defaultValue={defaults.note ?? ""}
            placeholder="e.g. Settled up for August"
          />
        </Field>
      </div>

      <div className="mt-4 rounded-lg border bg-[var(--surface-2)] px-3 py-2 text-sm">
        <span className="text-[var(--text-dim)]">Ledger effect: </span>
        <span
          className={`tabular font-semibold ${
            effective > 0 ? "text-[var(--up)]" : effective < 0 ? "text-[var(--down)]" : ""
          }`}
        >
          {fmtMoney(effective, { sign: true })}
        </span>
        <span className="text-[var(--text-faint)]">
          {" "}
          — {effective < 0 ? "cash collected from the player" : "cash paid to the player"}
        </span>
      </div>

      <div className="mt-5">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
