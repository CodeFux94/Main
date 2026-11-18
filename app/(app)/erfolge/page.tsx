import type { Metadata } from "next";
import { addDays, formatDate, formatDayMonth, isoWeekNumber, todayISO } from "@/lib/dates";
import { getActivities, getDeloads, getPhases, getRaces, getSessions, getSettings, requireUser } from "@/lib/data";
import { IMPORT_START_LOCAL } from "@/lib/strava/limits";
import {
  computeBadges, nextBadges, personalRecords, phaseSummaries, streaks, weekResults, type Badge, type WeekState,
} from "@/lib/metrics/achievements";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Erfolge" };

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });

const WEEK_STYLE: Record<WeekState, { cls: string; label: string }> = {
  fulfilled: { cls: "bg-[#3987e5]", label: "Plan erfüllt" },
  partial: { cls: "bg-zinc-700", label: "Einheiten verpasst" },
  open: { cls: "border border-[#3987e5] bg-transparent", label: "laufende Woche" },
  none: { cls: "border border-dashed border-zinc-700 bg-transparent", label: "nichts geplant" },
};

export default async function ErfolgePage() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const [phases, races, deloads, settings] = await Promise.all([
    getPhases(supabase),
    getRaces(supabase),
    getDeloads(supabase),
    getSettings(supabase),
  ]);
  const planStart = phases[0]?.start_date ?? today;
  const planEnd = phases[phases.length - 1]?.end_date ?? today;
  const [sessions, activities] = await Promise.all([
    getSessions(supabase, planStart, planEnd),
    getActivities(supabase, IMPORT_START_LOCAL, today),
  ]);

  const weeks = weekResults(sessions, planStart, today);
  const st = streaks(weeks);
  const records = personalRecords(activities, settings.weight_kg);
  const badges = computeBadges({ sessions, activities, phases, races, deloads, ftp: settings.ftp_w, today, planStart });
  const earned = badges.filter((b) => b.earnedAt).sort((a, b) => b.earnedAt!.localeCompare(a.earnedAt!));
  const upNext = nextBadges(badges, 6);
  const rest = badges.filter((b) => !b.earnedAt && !upNext.includes(b));
  const phaseList = phaseSummaries(sessions, activities, phases, today).filter((p) => p.finished || p.running);
  const recentWeeks = weeks.slice(-12);

  return (
    <>
      <PageHeader title="Erfolge" subtitle={`${earned.length} von ${badges.length} Badges`} />

      {/* Serien */}
      <section className="card mb-4">
        <h2 className="mb-3 font-semibold">Serie</h2>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <div className="text-5xl font-black leading-none">{st.current}</div>
            <div className="mt-1 text-sm text-zinc-400">{st.current === 1 ? "Woche" : "Wochen"} in Folge mit erfülltem Plan</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{st.longest}</div>
            <div className="text-xs text-zinc-400">längste Serie</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{weeks.filter((w) => w.state === "fulfilled").length}</div>
            <div className="text-xs text-zinc-400">erfüllte Wochen gesamt</div>
          </div>
        </div>
        {recentWeeks.length > 0 && (
          <>
            <div className="mt-4 flex gap-1.5" role="list" aria-label="Letzte Wochen">
              {recentWeeks.map((w) => (
                <div key={w.weekStart} role="listitem" className="flex flex-1 flex-col items-center gap-1" title={`KW ${isoWeekNumber(w.weekStart)}: ${WEEK_STYLE[w.state].label}${w.planned ? ` (${w.done}/${w.planned})` : ""}`}>
                  <div className={`h-6 w-full max-w-7 rounded ${WEEK_STYLE[w.state].cls}`} />
                  <span className="text-[9px] text-zinc-500">{isoWeekNumber(w.weekStart)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              {(Object.keys(WEEK_STYLE) as WeekState[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`inline-block h-2.5 w-2.5 rounded-sm ${WEEK_STYLE[k].cls}`} />
                  {WEEK_STYLE[k].label}
                </span>
              ))}
            </div>
          </>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Eine Woche zählt, wenn alle geplanten Einheiten erledigt sind (auch verschoben). Abgesagte Einheiten und Wochen
          ohne Plan unterbrechen die Serie nicht.
        </p>
      </section>

      {/* Bestwerte */}
      <h2 className="mb-2 text-lg font-semibold">Bestwerte</h2>
      {records.length === 0 ? (
        <div className="card mb-4 text-sm text-zinc-500">Noch keine Aktivitäten – verbinde Strava in den Einstellungen.</div>
      ) : (
        <div className="mb-1 grid grid-cols-2 gap-3 md:grid-cols-3">
          {records.map((r) => (
            <div key={r.key} className="card p-3.5">
              <div className="text-xs text-zinc-400">{r.label}</div>
              <div className="mt-1 text-xl font-semibold">
                {r.display}
                {r.extra && <span className="ml-1.5 text-sm font-normal text-zinc-400">{r.extra}</span>}
              </div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">
                {r.key.endsWith("week") ? `KW ${isoWeekNumber(r.date)} (${formatDayMonth(r.date)}–${formatDate(addDays(r.date, 6))})` : formatDate(r.date)}
              </div>
              {r.activityId && (
                <a href={`https://www.strava.com/activities/${r.activityId}`} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-orange-400 hover:underline">
                  {r.name || "Auf Strava"} ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="mb-6 text-[11px] text-zinc-600">Alle Aktivitäten seit {formatDate(IMPORT_START_LOCAL)}.</p>

      {/* Badges */}
      <h2 className="mb-2 text-lg font-semibold">Badges</h2>
      {earned.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {earned.map((b) => <BadgeCard key={b.key} b={b} />)}
        </div>
      )}
      {upNext.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-medium text-zinc-400">Als Nächstes</h3>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {upNext.map((b) => <BadgeCard key={b.key} b={b} />)}
          </div>
        </>
      )}
      {rest.length > 0 && (
        <details className="mb-6">
          <summary className="cursor-pointer text-sm text-zinc-400">Alle weiteren Badges ({rest.length})</summary>
          <ul className="mt-2 divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900/70 text-sm">
            {rest.map((b) => (
              <li key={b.key} className="flex items-center gap-3 px-3 py-2 opacity-70">
                <span className="text-xl grayscale" aria-hidden>{b.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{b.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{b.description}</span>
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {b.progress ? `${nf(b.progress.current, 1)}/${nf(b.progress.target)} ${b.progress.unit ?? ""}` : b.note ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Phasen */}
      <h2 className="mb-2 text-lg font-semibold">Phasen</h2>
      {phaseList.length === 0 ? (
        <div className="card text-sm text-zinc-500">Die erste Phase startet am {formatDate(planStart)}.</div>
      ) : (
        <div className="space-y-2">
          {phaseList.map((p) => (
            <div key={p.phase.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.phase.color }} />
                  <span className="font-semibold">{p.phase.name}</span>
                </div>
                <span className={`badge shrink-0 ${p.finished ? "bg-zinc-800 text-zinc-300" : "bg-sky-950 text-sky-300"}`}>
                  {p.finished ? "abgeschlossen" : "läuft"}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {formatDate(p.phase.start_date)} – {formatDate(p.phase.end_date)}
              </div>
              {p.planned > 0 && (
                <div className="mt-2 h-2 rounded-full bg-[#1c3a63]" role="meter" aria-valuenow={Math.round(p.completion * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.phase.name}: Einheiten erledigt`}>
                  <div className="h-full rounded-full bg-[#3987e5]" style={{ width: `${p.completion * 100}%` }} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-400">
                <span>
                  <b className="text-zinc-200">{p.done}/{p.planned}</b> Einheiten ({Math.round(p.completion * 100)} %)
                  {p.running && " bis heute"}
                </span>
                <span><b className="text-zinc-200">{nf(p.hours, 1)} h</b> Training</span>
                <span><b className="text-zinc-200">{nf(p.elevation)}</b> hm</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BadgeCard({ b }: { b: Badge }) {
  const got = Boolean(b.earnedAt);
  return (
    <div className={`card flex flex-col items-center p-3 text-center ${got ? "" : "opacity-60"}`} title={b.description}>
      <div className={`text-3xl ${got ? "" : "grayscale"}`} aria-hidden>{b.icon}</div>
      <div className="mt-1 text-sm font-semibold leading-tight">{b.title}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">{b.description}</div>
      {got ? (
        <div className="mt-1.5 text-[11px] text-zinc-300">✓ {formatDate(b.earnedAt!)}</div>
      ) : b.progress ? (
        <div className="mt-2 w-full">
          <div className="h-1.5 rounded-full bg-zinc-800" role="meter" aria-valuenow={b.progress.current} aria-valuemin={0} aria-valuemax={b.progress.target} aria-label={`${b.title}: Fortschritt`}>
            <div className="h-full rounded-full bg-zinc-400" style={{ width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {nf(b.progress.current, 1)} / {nf(b.progress.target)} {b.progress.unit}
          </div>
        </div>
      ) : (
        <div className="mt-1.5 text-[11px] text-zinc-500">{b.note ?? "noch offen"}</div>
      )}
    </div>
  );
}
