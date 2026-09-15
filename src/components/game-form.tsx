"use client";

import { useMemo, useState } from "react";
import { ActionForm, Field, SubmitButton, type ActionState } from "@/components/form";
import { suggestGameName, toDateInput } from "@/lib/dates";

type Roster = { id: string; name: string; active: boolean }[];

export function NewGameForm({
  action,
  roster,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
  roster: Roster;
}) {
  const today = toDateInput(new Date());
  const [date, setDate] = useState(today);
  const [name, setName] = useState(() => suggestGameName(new Date()));
  const [touchedName, setTouchedName] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    roster.filter((p) => p.active).map((p) => p.id),
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? roster.filter((p) => p.name.toLowerCase().includes(q)) : roster;
  }, [roster, search]);

  function onDateChange(value: string) {
    setDate(value);
    if (!touchedName) {
      const [y, m, d] = value.split("-").map(Number);
      if (y && m && d) setName(suggestGameName(new Date(y, m - 1, d, 12)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <ActionForm action={action} className="px-4 py-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input
            type="date"
            name="date"
            className="field"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            required
          />
        </Field>
        <Field label="Night name" hint="Auto-named from the date until you change it.">
          <input
            name="name"
            className="field"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setTouchedName(true);
            }}
            required
          />
        </Field>
        <Field label="Default buy-in (₹ INR)" hint="Every seated player starts with this amount in.">
          <input
            name="defaultBuyIn"
            type="number"
            step="0.01"
            min="0"
            className="field"
            defaultValue="20"
          />
        </Field>
        <Field label="Location">
          <input name="location" className="field" placeholder="e.g. Mark's garage" />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Notes">
          <textarea name="notes" rows={2} className="field" />
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="label mb-0">Who&apos;s playing ({selected.length} seated)</label>
          <div className="flex gap-2">
            <input
              className="field field-sm w-40"
              placeholder="Search roster"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelected(roster.map((p) => p.id))}
            >
              All
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSelected([])}>
              None
            </button>
          </div>
        </div>

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-[var(--text-dim)]">
            No players on the roster yet — add some first.
          </p>
        ) : (
          <div className="grid max-h-72 grid-cols-2 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-3">
            {visible.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    on
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                      on ? "border-[var(--accent)] bg-[var(--accent)] text-white" : ""
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="truncate">{p.name}</span>
                  {!p.active ? (
                    <span className="ml-auto text-[10px] text-[var(--text-faint)]">inactive</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {selected.map((id) => (
          <input key={id} type="hidden" name="playerIds" value={id} />
        ))}
      </div>

      <div className="mt-5">
        <SubmitButton pendingLabel="Creating…">Create night</SubmitButton>
      </div>
    </ActionForm>
  );
}
