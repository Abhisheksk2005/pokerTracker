"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: true; message?: string; error?: string } | null;

export function SubmitButton({
  children,
  className = "btn btn-primary btn-cta",
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Wraps a server action, surfacing its success/error message above the fields. */
export function ActionForm({
  action,
  children,
  className = "",
  id,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState | void>;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, fd) => ((await action(prev, fd)) as ActionState) ?? null,
    null,
  );

  return (
    <form action={formAction} className={className} id={id}>
      {state?.error ? (
        <p role="alert" className="mb-3 rounded-lg border border-[var(--down)] bg-[var(--down-soft)] px-3 py-2 text-sm text-[var(--down)]">
          {state.error}
        </p>
      ) : null}
      {state?.ok && state.message ? (
        <p role="status" className="mb-3 rounded-lg border border-[var(--up)] bg-[var(--up-soft)] px-3 py-2 text-sm text-[var(--up)]">
          {state.message}
        </p>
      ) : null}
      {children}
    </form>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint ? <p className="mt-1 text-xs text-[var(--text-faint)]">{hint}</p> : null}
    </div>
  );
}

/** Delete/confirm button for plain (non-state) server actions. */
export function ConfirmButton({
  children,
  message,
  className = "btn btn-danger btn-sm",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
