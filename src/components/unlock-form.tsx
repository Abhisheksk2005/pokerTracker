"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form";
import { unlock } from "@/lib/auth-actions";

export function UnlockForm({ next }: { next: string }) {
  const [state, action] = useActionState(unlock, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-3 text-left">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="passcode" className="label">
        Group passcode
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        className="field unlock-field"
        autoComplete="current-password"
        autoFocus
        required
      />
      {state?.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Checking…">Unlock the table</SubmitButton>
    </form>
  );
}
