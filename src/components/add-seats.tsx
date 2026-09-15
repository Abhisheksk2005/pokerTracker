"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/form";

export function AddSeats({
  gameId,
  candidates,
  action,
}: {
  gameId: string;
  candidates: { id: string; name: string; active: boolean }[];
  action: (fd: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  if (candidates.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-[var(--text-dim)]">
        Everyone on the roster is already seated.
      </p>
    );
  }

  const q = search.trim().toLowerCase();
  const visible = q ? candidates.filter((c) => c.name.toLowerCase().includes(q)) : candidates;

  return (
    <form action={action} className="px-4 py-4">
      <input type="hidden" name="gameId" value={gameId} />
      <input
        className="field field-sm mb-2 w-48"
        placeholder="Search roster"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {visible.map((c) => {
          const on = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                setSelected((prev) =>
                  prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                )
              }
              className={`chip cursor-pointer ${on ? "chip-accent" : ""}`}
            >
              {on ? "✓ " : "+ "}
              {c.name}
            </button>
          );
        })}
      </div>
      {selected.map((id) => (
        <input key={id} type="hidden" name="playerIds" value={id} />
      ))}
      <div className="mt-3">
        <SubmitButton className="btn btn-sm btn-primary" pendingLabel="Adding…">
          Seat {selected.length || ""} {selected.length === 1 ? "player" : "players"}
        </SubmitButton>
      </div>
    </form>
  );
}
