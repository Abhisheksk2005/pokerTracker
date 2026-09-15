"use client";

import { useState } from "react";
import { ActionForm, SubmitButton, type ActionState } from "@/components/form";
import { fmtMoney, fmtPct, toCents } from "@/lib/money";

export type EditorRow = {
  id: string;
  playerId: string;
  playerName: string;
  buyIn: number;
  cashOut: number;
  rebuys: number;
  adjustment: number;
  note: string | null;
};

type Draft = { buyIn: string; cashOut: string; rebuys: string; adjustment: string; note: string };

const rupees = (cents: number) => (cents / 100).toString();

/**
 * The results grid. Profit, ROI and the running bank delta recompute as you
 * type, so a mis-keyed cash-out is obvious before you ever hit save.
 */
export function EntriesEditor({
  gameId,
  rows,
  action,
  defaultBuyIn,
}: {
  gameId: string;
  rows: EditorRow[];
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
  defaultBuyIn: number;
}) {
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          buyIn: rupees(r.buyIn),
          cashOut: rupees(r.cashOut),
          rebuys: String(r.rebuys),
          adjustment: rupees(r.adjustment),
          note: r.note ?? "",
        },
      ]),
    ),
  );

  function set(id: string, key: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  /** Rebuys are a convenience: bumping them re-derives the buy-in total. */
  function bumpRebuys(id: string, delta: number) {
    setDraft((prev) => {
      const cur = prev[id];
      const next = Math.max(0, Number(cur.rebuys || 0) + delta);
      return {
        ...prev,
        [id]: {
          ...cur,
          rebuys: String(next),
          buyIn: rupees(defaultBuyIn * (1 + next)),
        },
      };
    });
  }

  const computed = rows.map((r) => {
    const d = draft[r.id];
    const buyIn = toCents(d.buyIn);
    const cashOut = toCents(d.cashOut);
    const adjustment = toCents(d.adjustment);
    return { ...r, buyIn, cashOut, adjustment, profit: cashOut - buyIn + adjustment };
  });

  const totalIn = computed.reduce((s, r) => s + r.buyIn, 0);
  const totalOut = computed.reduce((s, r) => s + r.cashOut, 0);
  const delta = totalIn - totalOut;

  return (
    <ActionForm action={action}>
      <input type="hidden" name="gameId" value={gameId} />

      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Player</th>
              <th className="num">Rebuys</th>
              <th className="num">Buy-in ₹</th>
              <th className="num">Cash-out ₹</th>
              <th className="num">Adjust ₹</th>
              <th className="num">Profit</th>
              <th className="num">ROI</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {computed.map((r) => {
              const d = draft[r.id];
              const roi = r.buyIn > 0 ? r.profit / r.buyIn : null;
              return (
                <tr key={r.id}>
                  <td className="font-medium">{r.playerName}</td>
                  <td className="num">
                    <span className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm px-1.5"
                        onClick={() => bumpRebuys(r.id, -1)}
                        aria-label={`Remove a rebuy for ${r.playerName}`}
                      >
                        −
                      </button>
                      <input
                        name={`rebuys:${r.id}`}
                        value={d.rebuys}
                        onChange={(e) => set(r.id, "rebuys", e.target.value)}
                        className="field field-sm w-12 text-center"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        className="btn btn-sm px-1.5"
                        onClick={() => bumpRebuys(r.id, 1)}
                        aria-label={`Add a rebuy for ${r.playerName}`}
                      >
                        +
                      </button>
                    </span>
                  </td>
                  <td className="num">
                    <input
                      name={`buyIn:${r.id}`}
                      value={d.buyIn}
                      onChange={(e) => set(r.id, "buyIn", e.target.value)}
                      className="field field-sm w-24 text-right"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="num">
                    <input
                      name={`cashOut:${r.id}`}
                      value={d.cashOut}
                      onChange={(e) => set(r.id, "cashOut", e.target.value)}
                      className="field field-sm w-24 text-right"
                      inputMode="decimal"
                    />
                  </td>
                  <td className="num">
                    <input
                      name={`adjustment:${r.id}`}
                      value={d.adjustment}
                      onChange={(e) => set(r.id, "adjustment", e.target.value)}
                      className="field field-sm w-20 text-right"
                      inputMode="decimal"
                    />
                  </td>
                  <td
                    className={`num font-semibold ${
                      r.profit > 0
                        ? "text-[var(--up)]"
                        : r.profit < 0
                          ? "text-[var(--down)]"
                          : ""
                    }`}
                  >
                    {fmtMoney(r.profit, { sign: true })}
                  </td>
                  <td className="num text-[var(--text-dim)]">{fmtPct(roi)}</td>
                  <td>
                    <input
                      name={`note:${r.id}`}
                      value={d.note}
                      onChange={(e) => set(r.id, "note", e.target.value)}
                      className="field field-sm w-40"
                      placeholder="—"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            <span className="text-[var(--text-dim)]">Total in </span>
            <span className="tabular font-semibold">{fmtMoney(totalIn)}</span>
          </span>
          <span>
            <span className="text-[var(--text-dim)]">Total out </span>
            <span className="tabular font-semibold">{fmtMoney(totalOut)}</span>
          </span>
          <span className={delta === 0 ? "chip chip-up" : "chip chip-down"}>
            {delta === 0 ? "Balanced" : `${fmtMoney(delta, { sign: true })} unaccounted`}
          </span>
        </div>
        <SubmitButton>Save amounts</SubmitButton>
      </div>
    </ActionForm>
  );
}
