"use client";

import { useActionState, type ReactNode } from "react";

export interface FormResult {
  ok?: string;
  error?: string;
}

type Action = (prev: FormResult, fd: FormData) => Promise<FormResult>;

/** Formular für Server Actions mit Erfolgs-/Fehlermeldung. */
export function ActionForm({
  action,
  children,
  submitLabel = "Speichern",
  className = "",
  extraButtons,
}: {
  action: Action;
  children: ReactNode;
  submitLabel?: string;
  className?: string;
  extraButtons?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="btn-primary py-2" disabled={pending}>
          {pending ? "Speichere …" : submitLabel}
        </button>
        {extraButtons}
        {state.ok && !pending && <span className="text-xs text-emerald-400">{state.ok}</span>}
        {state.error && !pending && <span className="text-xs text-red-400">{state.error}</span>}
      </div>
    </form>
  );
}
