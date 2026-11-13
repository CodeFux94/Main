"use client";

import { useState, useTransition } from "react";
import { generatePlanAction, type ActionResult } from "@/app/(app)/kalender/actions";

export function GeneratePlanButton({ label = "Plan erzeugen", className = "btn-primary" }: { label?: string; className?: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ActionResult>({});
  return (
    <div className="space-y-2">
      <button className={className} disabled={pending} onClick={() => start(async () => setRes(await generatePlanAction()))}>
        {pending ? "Erzeuge …" : label}
      </button>
      {res.ok && <p className="text-sm text-emerald-400">{res.ok}</p>}
      {res.error && <p className="text-sm text-red-400">{res.error}</p>}
    </div>
  );
}
