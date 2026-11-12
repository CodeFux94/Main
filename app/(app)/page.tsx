import Link from "next/link";
import { diffDays, endOfWeek, formatDate, formatShort, isWithin, isoWeekNumber, startOfWeek, todayISO } from "@/lib/dates";
import { getDeloads, getOverrides, getPhases, getRaces, getSessions, requireUser } from "@/lib/data";
import { phaseForDate, phaseWeek } from "@/lib/plan/generate";
import { sessionStatus } from "@/lib/plan/status";
import { PHASE_KIND_LABELS } from "@/lib/plan/types";
import { PageHeader } from "@/components/page-header";
import { SessionCard } from "@/components/session-card";
import { IconFlag } from "@/components/icons";

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const from = startOfWeek(today);
  const to = endOfWeek(today);
  const [phases, races, deloads, overrides, week] = await Promise.all([
    getPhases(supabase),
    getRaces(supabase),
    getDeloads(supabase),
    getOverrides(supabase),
    getSessions(supabase, from, to),
  ]);
  const overrideKeys = new Set(overrides.map((o) => o.slot_key));

  const phase = phaseForDate(phases, today);
  const nextPhase = phases.find((p) => p.start_date > today);
  const deload = deloads.find((w) => isWithin(today, w.start_date, w.end_date));
  const active = week.filter((s) => !s.cancelled);
  const done = active.filter((s) => ["done", "shifted"].includes(sessionStatus(s, today))).length;
  const upcoming = week.filter((s) => s.date >= today);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`KW ${isoWeekNumber(today)} · ${formatDate(today)}`} />

      <div className="grid gap-3 sm:grid-cols-2">
        {races.map((r) => {
          const days = diffDays(today, r.start_date);
          const running = isWithin(today, r.start_date, r.end_date);
          return (
            <div key={r.id} className="card relative overflow-hidden border-yellow-900/60">
              <div className="absolute -right-4 -top-4 text-yellow-500/10">
                <IconFlag width={96} height={96} />
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-yellow-400">{r.name}</div>
              <div className="mt-1 text-4xl font-black tabular-nums">
                {running ? "Heute!" : days > 0 ? days : "✓"}
                {!running && days > 0 && <span className="ml-1 text-base font-semibold text-zinc-400">Tage</span>}
              </div>
              <div className="text-xs text-zinc-400">
                {formatDate(r.start_date)} – {formatDate(r.end_date)}
                {days > 0 && ` · ${Math.floor(days / 7)} Wochen`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-3">
        <div className="label">Aktuelle Phase</div>
        {phase ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: phase.color }} />
              <span className="text-lg font-semibold">{phase.name}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              {PHASE_KIND_LABELS[phase.kind]} · Woche {phaseWeek(phase, today).week} von {phaseWeek(phase, today).total} ·
              bis {formatDate(phase.end_date)}
            </div>
            {phase.focus && <div className="mt-1 text-sm text-zinc-300">Fokus: {phase.focus}</div>}
            {deload && (
              <div className="mt-2 inline-block rounded-lg bg-sky-950 px-2 py-1 text-xs text-sky-300">
                Entlastungswoche · {Math.round(deload.volume_factor * 100)} % Umfang
              </div>
            )}
          </>
        ) : nextPhase ? (
          <div className="text-sm">
            Vorbereitung startet am <b>{formatShort(nextPhase.start_date)}</b> mit „{nextPhase.name}“ (in{" "}
            {diffDays(today, nextPhase.start_date)} Tagen).
          </div>
        ) : (
          <div className="text-sm text-zinc-400">Keine aktive Phase.</div>
        )}
      </div>

      <div className="card mt-3">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="label">Diese Woche</div>
            <div className="text-2xl font-bold tabular-nums">
              {done}
              <span className="text-base font-medium text-zinc-400"> / {active.length} Einheiten</span>
            </div>
          </div>
          <Link href={`/kalender?ansicht=woche&datum=${today}`} className="text-sm text-orange-400">
            Woche öffnen →
          </Link>
        </div>
        {active.length > 0 && (
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / active.length) * 100}%` }} />
          </div>
        )}
        {upcoming.length > 0 ? (
          <div className="space-y-2">
            <div className="label">Als Nächstes</div>
            {upcoming.slice(0, 3).map((s) => (
              <div key={s.id}>
                <div className="mb-1 text-xs text-zinc-500">{formatShort(s.date)}</div>
                <SessionCard session={s} status={sessionStatus(s, today)} hasOverride={overrideKeys.has(s.slot_key)} compact />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Keine weiteren Einheiten in dieser Woche.</p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-zinc-600">
        Stunden, Höhenmeter, Zonen und Belastungstrend folgen mit der Strava-Anbindung.
      </p>
    </>
  );
}
