import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, todayISO } from "@/lib/dates";
import { getSettings, requireUser } from "@/lib/data";
import { buildPhaseReport } from "@/lib/reports/build";
import { getPhaseReport, loadReportContext } from "@/lib/reports/service";
import { SESSION_TYPE_LABELS, PHASE_KIND_LABELS, type SessionType } from "@/lib/plan/types";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { ActionButton } from "@/components/action-button";
import { ZoneDistribution } from "@/components/charts/zone-distribution";
import { WeekColumns } from "@/components/charts/week-columns";
import { ReportInsights } from "@/components/report-parts";
import { regeneratePhaseAction } from "../../actions";

export const metadata: Metadata = { title: "Phasenbericht" };
export const maxDuration = 60;

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });

export default async function PhaseReportPage({ params }: PageProps<"/berichte/phase/[phaseId]">) {
  const { phaseId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(phaseId)) notFound();
  const today = todayISO();
  const { supabase } = await requireUser();
  const [stored, settings] = await Promise.all([getPhaseReport(supabase, phaseId), getSettings(supabase)]);
  let r = stored?.data;
  if (!r) {
    const ctx = await loadReportContext(supabase, today);
    if (!ctx.phases.some((p) => p.id === phaseId)) notFound();
    r = buildPhaseReport(ctx, phaseId);
  }
  const t = r.totals;
  const finished = r.phase.end_date < today;
  const missed = (Object.entries(r.missedByType) as [SessionType, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader
        title={r.phase.name}
        subtitle={`${PHASE_KIND_LABELS[r.phase.kind]} · ${formatDate(r.phase.start_date)} – ${formatDate(r.phase.end_date)}`}
      />
      <div className="mb-4 flex items-center justify-between">
        <Link href="/berichte" className="text-sm text-orange-400">← Archiv</Link>
        {r.phase.focus && <span className="text-xs text-zinc-500">Fokus: {r.phase.focus}</span>}
      </div>
      {!stored && (
        <div className="card mb-3 border-sky-900 bg-sky-950/30 text-sm text-sky-200">
          {finished ? "Vorschau – der Phasenbericht wird automatisch gespeichert." : "Zwischenstand der laufenden Phase – der Bericht wird nach Phasenende gespeichert."}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Einheiten erledigt" value={`${Math.round(r.completion * 100)} %`} sub={`${t.done}/${t.planned} · ${r.fulfilledWeeks} volle Wochen`} />
        <StatTile label="Stunden" value={nf(t.hours, 1)} unit="h" sub={t.plannedMaxH ? `Soll ${nf(t.plannedMinH)}–${nf(t.plannedMaxH)} h` : undefined} />
        <StatTile label="Höhenmeter" value={nf(t.elevation)} unit="hm" sub={`${nf(t.distanceKm)} km`} />
        <StatTile label="Belastung (TRIMP)" value={nf(t.trimp)} sub={`${t.activities} Aktivitäten`} />
      </div>

      <div className="mt-3">
        <ReportInsights highlights={r.highlights} potentials={r.potentials} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <WeekColumns
          title="Stunden pro Woche"
          unit="h"
          rangeLabel="Soll-Spanne"
          columns={r.weeks.map((w) => ({
            key: w.weekStart,
            label: `KW ${w.kw}`,
            value: w.hours,
            rangeMin: w.plannedMaxH ? w.plannedMinH : undefined,
            rangeMax: w.plannedMaxH ? w.plannedMaxH : undefined,
            details: [
              ["Stunden", `${nf(w.hours, 1)} h`],
              ["Soll", w.plannedMaxH ? `${nf(w.plannedMinH, 1)}–${nf(w.plannedMaxH, 1)} h` : "–"],
              ["Einheiten", w.planned ? `${w.done}/${w.planned}` : "–"],
              ["Höhenmeter", nf(w.elevation)],
              ["Belastung", nf(w.trimp)],
            ],
          }))}
        />
        <div className="space-y-3">
          <ZoneDistribution title="Intensitätsverteilung der Phase" zones={t.zoneSeconds} bounds={settings} />
          {missed.length > 0 && (
            <section className="card">
              <h2 className="mb-2 font-semibold">Verpasste Einheiten</h2>
              <ul className="space-y-1 text-sm">
                {missed.map(([type, n]) => (
                  <li key={type} className="flex justify-between">
                    <span className="text-zinc-300">{SESSION_TYPE_LABELS[type]}</span>
                    <span className="text-zinc-400">{n}×</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {r.next && (
        <section className="card mt-3 border-orange-900/60">
          <div className="label">Als Nächstes</div>
          <div className="font-semibold">{r.next.name}</div>
          <div className="text-sm text-zinc-400">ab {formatDate(r.next.start_date)}{r.next.focus ? ` · Fokus: ${r.next.focus}` : ""}</div>
        </section>
      )}

      {finished && (
        <div className="mt-4">
          <ActionButton
            action={regeneratePhaseAction.bind(null, phaseId)}
            label={stored ? "Neu berechnen" : "Bericht speichern"}
            className="btn-ghost px-2 py-1 text-xs"
            confirmText={stored ? "Phasenbericht mit den aktuellen Daten neu berechnen?" : undefined}
          />
        </div>
      )}
    </>
  );
}
