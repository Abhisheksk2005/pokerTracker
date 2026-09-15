"use client";

import { ActionForm, Field, SubmitButton, type ActionState } from "@/components/form";

export type PlayerDefaults = {
  id?: string;
  name?: string;
  nickname?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  active?: boolean;
};

export function PlayerForm({
  action,
  defaults = {},
  submitLabel = "Save player",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
  defaults?: PlayerDefaults;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} className="px-4 py-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" hint="How they show up on every leaderboard.">
          <input
            name="name"
            className="field"
            required
            defaultValue={defaults.name ?? ""}
            placeholder="e.g. Denis"
          />
        </Field>
        <Field label="Nickname">
          <input name="nickname" className="field" defaultValue={defaults.nickname ?? ""} />
        </Field>
        <Field label="Email">
          <input type="email" name="email" className="field" defaultValue={defaults.email ?? ""} />
        </Field>
        <Field label="Phone">
          <input name="phone" className="field" defaultValue={defaults.phone ?? ""} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Notes" hint="Regular, occasional, who they owe — whatever helps.">
          <textarea name="notes" rows={3} className="field" defaultValue={defaults.notes ?? ""} />
        </Field>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults.active ?? true}
          className="h-4 w-4"
        />
        Active in the group
      </label>

      <div className="mt-5 flex gap-2">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
