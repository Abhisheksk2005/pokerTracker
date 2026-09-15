"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type ActionState } from "@/components/form";

type GroupAction = (prev: ActionState, fd: FormData) => Promise<ActionState | void>;

export function CreateGroupForm({
  action,
  players,
}: {
  action: GroupAction;
  players: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={action} className="space-y-4 px-5 py-5">
      <Field label="Group name" hint="This appears in the switcher and on every scoped page.">
        <input name="name" className="field" placeholder="e.g. River Rats" required />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          className="field"
          rows={2}
          placeholder="When you play, who it is for, or a house rule."
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Owner profile" hint="Choose a normal player profile if it already exists.">
          <select name="ownerId" className="field" defaultValue="">
            <option value="">
              Create a new profile below
            </option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Accent">
          <select name="accent" className="field" defaultValue="#ff6a4d">
            <option value="#ff6a4d">Coral</option>
            <option value="#8b7bff">Violet</option>
            <option value="#3ddc91">Mint</option>
            <option value="#ffc857">Gold</option>
            <option value="#5ecbff">Sky</option>
          </select>
        </Field>
      </div>
      <Field label="New owner profile" hint="No login or password—just the name shown around the table.">
        <input name="ownerName" className="field" placeholder="e.g. Prasad" />
      </Field>
      <SubmitButton pendingLabel="Creating…">Create group</SubmitButton>
    </ActionForm>
  );
}

export function JoinGroupForm({
  action,
  players,
}: {
  action: GroupAction;
  players: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={action} className="space-y-4 px-5 py-5">
      <Field label="Invite code" hint="Codes are case-insensitive and can be pasted with spaces.">
        <input
          name="inviteCode"
          className="field font-mono uppercase tracking-[0.18em]"
          placeholder="HOME-ACES"
          autoCapitalize="characters"
          required
        />
      </Field>
      <Field label="Player joining">
        <select name="playerId" className="field" defaultValue="" required>
          <option value="" disabled>
            Choose a player…
          </option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton pendingLabel="Joining…">Join with code</SubmitButton>
    </ActionForm>
  );
}

export function CopyInvite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {copied ? "Copied" : "Copy code"}
    </button>
  );
}
