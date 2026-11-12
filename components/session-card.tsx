"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelSessionAction, moveSessionAction, resetSessionAction, type ActionResult } from "@/app/(app)/kalender/actions";
import { formatDayMonth, formatRange, formatShort, formatTime } from "@/lib/dates";
import { STATUS_LABELS, type PlannedSession, type SessionStatus } from "@/lib/plan/types";
import { STATUS_CLASSES, TYPE_COLORS } from "@/lib/plan/style";

interface Props {
  session: PlannedSession;
  status: SessionStatus;
  hasOverride: boolean;
  compact?: boolean;
}

export function SessionCard({ session: s, status, hasOverride, compact }: Props) {
  const [mode, setMode] = useState<"view" | "move">("view");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<ActionResult>({});
  const [moveState, moveAction, movePending] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const r = await moveSessionAction(prev, fd);
    if (r.ok) setMode("view");
    return r;
  }, {});

  const run = (fn: () => Promise<ActionResult>) => startTransition(async () => setMsg(await fn()));
  const editable = s.session_type !== "race" && status !== "done" && status !== "shifted";
  const moved = s.date !== s.original_date;

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 ${s.cancelled ? "opacity-60" : ""}`}
      style={{ borderLeft: `4px solid ${TYPE_COLORS[s.session_type]}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-semibold leading-tight ${s.cancelled ? "line-through" : ""}`}>{s.title}</div>
          <div className="mt-0.5 text-xs text-zinc-400">
            {s.start_time ? `${formatTime(s.start_time)} Uhr` : "ganztägig"}
            {s.target_min != null && ` · ${formatRange(s.target_min, s.target_max)}`}
            {moved && ` · verschoben vom ${formatDayMonth(s.original_date)}`}
          </div>
          {s.note && !compact && <div className="mt-1 text-xs italic text-zinc-500">{s.note}</div>}
        </div>
        <span className={`badge shrink-0 ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>
      </div>

      {!compact && editable && mode === "view" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!s.cancelled && (
            <>
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setMode("move")} disabled={pending}>
                Verschieben
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                disabled={pending}
                onClick={() => {
                  if (confirm(`„${s.title}“ am ${formatShort(s.date)} absagen?`)) run(() => cancelSessionAction(s.slot_key));
                }}
              >
                Absagen
              </button>
            </>
          )}
          {hasOverride && (
            <button className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => resetSessionAction(s.slot_key))}>
              {s.cancelled ? "Wieder einplanen" : "Zurücksetzen"}
            </button>
          )}
        </div>
      )}

      {mode === "move" && (
        <form action={moveAction} className="mt-3 grid grid-cols-2 gap-2">
          <input type="hidden" name="slot_key" value={s.slot_key} />
          <label className="col-span-1">
            <span className="label">Datum</span>
            <input type="date" name="new_date" defaultValue={s.date} required className="input py-2 text-sm" />
          </label>
          <label className="col-span-1">
            <span className="label">Uhrzeit</span>
            <input type="time" name="new_time" defaultValue={formatTime(s.start_time)} className="input py-2 text-sm" />
          </label>
          <label className="col-span-2">
            <span className="label">Notiz (optional)</span>
            <input name="note" className="input py-2 text-sm" placeholder="z. B. Termin, Wetter" />
          </label>
          <div className="col-span-2 flex gap-2">
            <button className="btn-primary flex-1 py-2 text-xs" disabled={movePending}>
              {movePending ? "Speichere …" : "Speichern"}
            </button>
            <button type="button" className="btn-ghost py-2 text-xs" onClick={() => setMode("view")}>
              Abbrechen
            </button>
          </div>
          {moveState.error && <p className="col-span-2 text-xs text-red-400">{moveState.error}</p>}
        </form>
      )}
      {msg.error && <p className="mt-2 text-xs text-red-400">{msg.error}</p>}
    </div>
  );
}
