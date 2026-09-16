"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/form";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/poker-ui";
import { toDateInput } from "@/lib/dates";
import { fmtMoney } from "@/lib/money";
import type { Settlement } from "@/lib/settle";
import type { ActionState } from "@/components/form";

/**
 * "Who pays who" for the whole group. Each row is one payment; recording it
 * writes the matching pair of ledger entries and the list recalculates.
 */
export function SettleUp({
  settlements,
  imbalance,
  owed,
  action,
}: {
  settlements: Settlement[];
  imbalance: number;
  owed: number;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, fd) => ((await action(prev, fd)) as ActionState) ?? null,
    null,
  );

  if (!settlements.length) {
    return (
      <section className="settle-card settle-card-clear">
        <span className="settle-clear-icon">
          <Icon name="check" size={22} />
        </span>
        <div>
          <strong>Everyone is square.</strong>
          <p>No payments outstanding across all your nights.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="settle-card">
      <header>
        <span className="eyebrow">SETTLE UP</span>
        <h2>
          {settlements.length} {settlements.length === 1 ? "payment" : "payments"} to square{" "}
          {fmtMoney(owed)}
        </h2>
        <p>Fewest payments that clear every balance across all games.</p>
      </header>

      {state?.error ? <p className="settle-message settle-error">{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className="settle-message settle-ok">{state.message}</p>
      ) : null}

      <ul className="settle-list">
        {settlements.map((settlement) => {
          const key = `${settlement.fromId}:${settlement.toId}:${settlement.amount}`;
          const isOpen = open === key;
          return (
            <li key={key} className="settle-row">
              <button
                type="button"
                className="settle-summary"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
              >
                <Avatar name={settlement.fromName} />
                <span className="settle-names">
                  <strong>{settlement.fromName}</strong>
                  <span>
                    pays <b>{settlement.toName}</b>
                  </span>
                </span>
                <span className="settle-amount">{fmtMoney(settlement.amount)}</span>
                <Icon name={isOpen ? "close" : "plus"} size={15} />
              </button>

              {isOpen ? (
                <form action={formAction} className="settle-form">
                  <input type="hidden" name="fromId" value={settlement.fromId} />
                  <input type="hidden" name="toId" value={settlement.toId} />
                  <div className="settle-fields">
                    <label>
                      <span className="label">Amount (₹ INR)</span>
                      <input
                        name="amount"
                        className="field"
                        inputMode="decimal"
                        defaultValue={(settlement.amount / 100).toString()}
                        required
                      />
                    </label>
                    <label>
                      <span className="label">Date paid</span>
                      <input
                        type="date"
                        name="date"
                        className="field"
                        defaultValue={toDateInput(new Date())}
                        required
                      />
                    </label>
                    <label>
                      <span className="label">Method</span>
                      <select name="method" className="field" defaultValue="CASH">
                        <option value="CASH">CASH</option>
                        <option value="BANK">BANK</option>
                        <option value="UPI">UPI</option>
                        <option value="CARD">CARD</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </label>
                  </div>
                  <p className="settle-hint">
                    Records {settlement.fromName} paying in and {settlement.toName} being paid out.
                    Pay part of it by lowering the amount.
                  </p>
                  <SubmitButton className="btn btn-primary w-full" pendingLabel="Recording…">
                    Mark as paid
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      {imbalance !== 0 ? (
        <p className="settle-imbalance">
          {fmtMoney(Math.abs(imbalance))} {imbalance > 0 ? "more collected than paid out" : "more paid out than collected"}.
          Finish and settle any open night, or check for a missing entry.
        </p>
      ) : null}
    </section>
  );
}
