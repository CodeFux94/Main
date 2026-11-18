import { formatMinutes, formatShort } from "@/lib/dates";
import { STATUS_LABELS, type SessionStatus } from "@/lib/plan/types";
import { STATUS_CLASSES, TYPE_COLORS } from "@/lib/plan/style";
import type { ReportSession } from "@/lib/reports/build";
import { sportLabel } from "./activity-line";

/** "Was war gut" und "Wo steckt Potenzial" nebeneinander. */
export function ReportInsights({ highlights, potentials }: { highlights: string[]; potentials: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="card">
        <h2 className="mb-2 font-semibold">Was war gut</h2>
        <ul className="space-y-2 text-sm">
          {highlights.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-emerald-400" aria-hidden>✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Wo steckt Potenzial</h2>
        <ul className="space-y-2 text-sm">
          {potentials.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-orange-400" aria-hidden>→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SessionTable({ sessions }: { sessions: ReportSession[] }) {
  if (!sessions.length) return <p className="text-sm text-zinc-500">Keine Einheiten geplant.</p>;
  const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });
  return (
    <ul className="divide-y divide-zinc-800">
      {sessions.map((s) => (
        <li key={`${s.date}-${s.session_type}`} className="flex items-start gap-3 py-2">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLORS[s.session_type] }} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-zinc-500">{formatShort(s.date)}</span>
              <span className={`font-medium ${s.status === "cancelled" ? "line-through text-zinc-500" : ""}`}>{s.title}</span>
            </div>
            {s.activity && (
              <div className="truncate text-xs text-zinc-400">
                {s.activity.local_date !== s.date && `am ${formatShort(s.activity.local_date)} · `}
                {formatMinutes(s.activity.moving_time_s / 60)}
                {s.activity.distance_m > 100 && ` · ${nf(s.activity.distance_m / 1000, 1)} km`}
                {s.activity.elevation_gain_m >= 1 && ` · ${nf(s.activity.elevation_gain_m)} hm`}
              </div>
            )}
          </div>
          <span className={`badge shrink-0 ${STATUS_CLASSES[s.status as SessionStatus]}`}>{STATUS_LABELS[s.status as SessionStatus]}</span>
        </li>
      ))}
    </ul>
  );
}

export function ExtraActivities({ items }: { items: { id: number; name: string; sport_type: string; local_date: string; moving_time_s: number }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 border-t border-zinc-800 pt-3">
      <div className="label">Zusätzlich</div>
      <ul className="space-y-1 text-sm">
        {items.map((a) => (
          <li key={a.id} className="flex justify-between gap-2 text-zinc-300">
            <span className="truncate">
              <span className="text-xs text-zinc-500">{formatShort(a.local_date)}</span> {a.name || sportLabel(a.sport_type)}
            </span>
            <span className="shrink-0 text-xs text-zinc-400">{sportLabel(a.sport_type)} · {formatMinutes(a.moving_time_s / 60)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
