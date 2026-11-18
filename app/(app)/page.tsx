import Link from "next/link";
import {
  addDays, diffDays, endOfWeek, formatDate, formatShort, isWithin, isoWeekNumber, startOfWeek, todayISO,
} from "@/lib/dates";
import { getActivities, getDeloads, getOverrides, getPhases, getRaces, getSessions, getSettings, requireUser } from "@/lib/data";
import { phaseForDate, phaseWeek } from "@/lib/plan/generate";
import { sessionStatus } from "@/lib/plan/status";
import { PHASE_KIND_LABELS } from "@/lib/plan/types";
import { deltaPct, lastWeeks, previousWeekToDate, type WeekStats } from "@/lib/metrics/weekly";
import { PageHeader } from "@/components/page-header";
import { SessionCard } from "@/components/session-card";
import { StatTile } from "@/components/stat-tile";
import { WeekColumns, type WeekColumn } from "@/components/charts/week-columns";
import { ZoneDistribution } from "@/components/charts/zone-distribution";
import { IconFlag } from "@/components/icons";

const WEEKS = 6;
const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });
const hours = (h: number) => `${nf(h, h < 10 ? 1 : 0)} h`;

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const from = addDays(startOfWeek(today), -7 * (WEEKS - 1));
  const to = endOfWeek(today);
  const [phases, races, deloads, overrides, sessions, activities, settings] = await Promise.all([
    getPhases(supabase),
    getRaces(supabase),
    getDeloads(supabase),
    getOverrides(supabase),
    getSessions(supabase, from, to),
    getActivities(supabase, from, to),
    getSettings(supabase),
  ]);
  const overrideKeys = new Set(overrides.map((o) => o.slot_key));

  const weeks = lastWeeks(WEEKS, sessions, activities, today);
  const cur = weeks[WEEKS - 1];
  const prev = previousWeekToDate(sessions, activities, today);
  const phase = phaseForDate(phases, today);
  const nextPhase = phases.find((p) => p.start_date > today);
  const deload = deloads.find((w) => isWithin(today, w.start_date, w.end_date));
  const upcoming = sessions.filter((s) => s.date >= today && s.date <= to && !s.cancelled && sessionStatus(s, today) === "planned");
  const sixWeekZones = weeks.reduce<number[]>((acc, w) => acc.map((x, i) => x + w.zoneSeconds[i]), [0, 0, 0, 0, 0]);

  const details = (w: WeekStats): [string, string][] => [
    ["Stunden", hours(w.hours)],
    ["Soll", w.plannedMaxH ? `${nf(w.plannedMinH, 1)}–${nf(w.plannedMaxH, 1)} h` : "–"],
    ["Einheiten", w.planned ? `${w.done}/${w.planned}` : "–"],
    ["Höhenmeter", nf(w.elevation)],
    ["Belastung", nf(w.trimp)],
  ];
  const col = (w: WeekStats, value: number, range: boolean): WeekColumn => ({
    key: w.weekStart,
    label: `KW ${isoWeekNumber(w.weekStart)}`,
    value,
    rangeMin: range && w.plannedMaxH ? w.plannedMinH : undefined,
    rangeMax: range && w.plannedMaxH ? w.plannedMaxH : undefined,
    current: w === cur,
    details: details(w),
  });

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
              <div className="mt-1 text-4xl font-black">
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

      <div className="mb-2 mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Diese Woche</h2>
        <Link href={`/kalender?ansicht=woche&datum=${today}`} className="text-sm text-orange-400">
          Woche öffnen →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Einheiten Soll/Ist"
          value={`${cur.done}/${cur.planned}`}
          sub={cur.missed ? `${cur.missed} verpasst` : cur.planned ? "nichts verpasst" : "keine geplant"}
        >
          {cur.planned > 0 && (
            <div className="mt-2 h-2 rounded-full bg-[#1c3a63]" role="meter" aria-valuenow={cur.done} aria-valuemin={0} aria-valuemax={cur.planned} aria-label="Erledigte Einheiten">
              <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${(cur.done / cur.planned) * 100}%` }} />
            </div>
          )}
        </StatTile>
        <StatTile
          label="Stunden"
          value={nf(cur.hours, 1)}
          unit="h"
          sub={cur.plannedMaxH ? `Soll ${nf(cur.plannedMinH, 1)}–${nf(cur.plannedMaxH, 1)} h` : undefined}
          delta={deltaPct(cur.hours, prev.hours)}
        />
        <StatTile label="Höhenmeter" value={nf(cur.elevation)} unit="hm" delta={deltaPct(cur.elevation, prev.elevation)} />
        <StatTile label="Belastung (TRIMP)" value={nf(cur.trimp)} delta={deltaPct(cur.trimp, prev.trimp)} />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-600">Veränderung gegenüber der Vorwoche bis zum gleichen Wochentag</p>

      {upcoming.length > 0 && (
        <div className="card mt-3">
          <div className="label mb-2">Als Nächstes</div>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((s) => (
              <div key={s.id}>
                <div className="mb-1 text-xs text-zinc-500">{formatShort(s.date)}</div>
                <SessionCard session={s} status={sessionStatus(s, today)} hasOverride={overrideKeys.has(s.slot_key)} compact />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ZoneDistribution title="Zonenverteilung diese Woche" zones={cur.zoneSeconds} bounds={settings} />
        <ZoneDistribution title={`Zonenverteilung letzte ${WEEKS} Wochen`} zones={sixWeekZones} bounds={settings} />
      </div>

      <h2 className="mb-2 mt-6 text-lg font-semibold">Letzte {WEEKS} Wochen</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <WeekColumns title="Trainingsstunden pro Woche" unit="h" rangeLabel="Soll-Spanne" columns={weeks.map((w) => col(w, w.hours, true))} />
        <WeekColumns title="Belastungstrend (TRIMP pro Woche)" unit="trimp" columns={weeks.map((w) => col(w, w.trimp, false))} />
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        TRIMP nach Edwards: Minuten je HF-Zone × Faktor 1–5. Ohne Herzfrequenz aus der Dauer geschätzt.
      </p>
    </>
  );
}
