"use client";

import { useState, useTransition } from "react";
import type { FormResult } from "./action-form";

/** Button, der eine Server Action ausführt (optional mit Rückfrage). */
export function ActionButton({
  action,
  label,
  confirmText,
  className = "btn-secondary",
}: {
  action: () => Promise<FormResult>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<FormResult>({});
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmText && !confirm(confirmText)) return;
          start(async () => setRes(await action()));
        }}
      >
        {pending ? "…" : label}
      </button>
      {res.ok && <span className="text-xs text-emerald-400">{res.ok}</span>}
      {res.error && <span className="text-xs text-red-400">{res.error}</span>}
    </span>
  );
}
