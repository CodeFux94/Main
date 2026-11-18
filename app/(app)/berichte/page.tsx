import type { Metadata } from "next";
import Link from "next/link";
import { addDays, formatDate, formatDayMonth, isoWeekNumber, startOfWeek, todayISO } from "@/lib/dates";
import { getPhases, requireUser } from "@/lib/data";
import { phaseForDate } from "@/lib/plan/generate";
import { listReports, REPORTS_MIGRATION_HINT } from "@/lib/reports/service";
import { PageHeader } from "@/components/page-header";
import { ActionButton } from "@/components/action-button";
import { generateReportsAction } from "./actions";

export const metadata: Metadata = { title: "Berichte" };
export const maxDuration = 60;

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });

export default async function BerichtePage() {
  const { supabase } = await requireUser();
  const today = todayISO();
  const current = startOfWeek(today);
  const [{ missingSchema, weekly, phase }, phases] = await Promise.all([listReports(supabase), getPhases(supabase)]);
  const running = phaseForDate(phases, today);

  return (
    <>
      <PageHeader title="Berichte" subtitle="Jeden Montag automatisch – plus Phasenbericht am Ende jeder Phase" />

      {missingSchema && <div className="card mb-4 text-sm text-amber-400">{REPORTS_MIGRATION_HINT}</div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Link href={`/berichte/woche/${current}`} className="card block hover:border-zinc-600">
          <div className="label">Laufende Woche</div>
          <div className="font-semibold">Vorschau KW {isoWeekNumber(current)} →</div>
          <div className="text-xs text-zinc-500">
            {formatDayMonth(current)}–{formatDate(addDays(current, 6))} · Stand jetzt, wird Montag gespeichert
          </div>
        </Link>
        {running && running.kind !== "pause" && (
          <Link href={`/berichte/phase/${running.id}`} className="card block hover:border-zinc-600">
            <div className="label">Laufende Phase</div>
            <div className="font-semibold">Zwischenstand {running.name.split(" – ")[0]} →</div>
            <div className="text-xs text-zinc-500">bis {formatDate(running.end_date)} · Bericht folgt nach Phasenende</div>
          </Link>
        )}
        <div className="card">
          <div className="label">Archiv</div>
          <div className="text-sm text-zinc-400">
            {weekly.length} {weekly.length === 1 ? "Wochenreview" : "Wochenreviews"} · {phase.length} {phase.length === 1 ? "Phasenbericht" : "Phasenberichte"}
          </div>
          {!missingSchema && (
            <div className="mt-2">
              <ActionButton action={generateReportsAction} label="Fehlende Berichte erstellen" className="btn-secondary px-3 py-1.5 text-xs" />
            </div>
          )}
        </div>
      </div>

      {phase.length > 0 && (
        <>
          <h2 className="mb-2 text-lg font-semibold">Phasenberichte</h2>
          <div className="mb-6 space-y-2">
            {phase.map((p) => (
              <Link key={p.phase_id} href={`/berichte/phase/${p.phase_id}`} className="card flex items-center gap-3 p-3.5 hover:border-zinc-600">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.data.phase.color }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{p.data.phase.name}</div>
                  <div className="text-xs text-zinc-500">
                    {formatDate(p.data.phase.start_date)} – {formatDate(p.data.phase.end_date)} · {Math.round(p.data.completion * 100)} % erledigt ·{" "}
                    {nf(p.data.totals.hours, 1)} h
                  </div>
                </div>
                <span className="text-zinc-500">→</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 text-lg font-semibold">Wochenreviews</h2>
      {weekly.length === 0 ? (
        <div className="card text-sm text-zinc-500">
          Noch keine Berichte. Das erste Wochenreview erscheint am Montag nach der ersten Trainingswoche.
        </div>
      ) : (
        <div className="space-y-2">
          {weekly.map((w) => {
            const d = w.data;
            return (
              <Link key={w.week_start} href={`/berichte/woche/${w.week_start}`} className="card block p-3.5 hover:border-zinc-600">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold">
                    KW {d.kw} <span className="text-sm font-normal text-zinc-500">{formatDayMonth(d.weekStart)}–{formatDate(d.weekEnd)}</span>
                  </div>
                  {d.stats.planned > 0 && (
                    <span className={`badge ${d.stats.done === d.stats.planned ? "bg-emerald-950 text-emerald-300" : "bg-zinc-800 text-zinc-300"}`}>
                      {d.stats.done}/{d.stats.planned}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-zinc-400">
                  {d.phase?.name ?? "außerhalb des Plans"}
                  {d.deload ? " · Entlastung" : ""} · {nf(d.stats.hours, 1)} h · {nf(d.stats.elevation)} hm · TRIMP {nf(d.stats.trimp)}
                </div>
                <div className="mt-1 truncate text-xs text-zinc-500">✓ {d.highlights[0]}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
