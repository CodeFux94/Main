import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDays, formatDate, formatDayMonth, isISODate, isoWeekday, startOfWeek, todayISO } from "@/lib/dates";
import { getSettings, requireUser } from "@/lib/data";
import { buildWeeklyReport } from "@/lib/reports/build";
import { getWeeklyReport, loadReportContext } from "@/lib/reports/service";
import { deltaPct } from "@/lib/metrics/weekly";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { ActionButton } from "@/components/action-button";
import { ZoneDistribution } from "@/components/charts/zone-distribution";
import { ExtraActivities, ReportInsights, SessionTable } from "@/components/report-parts";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { regenerateWeeklyAction } from "../../actions";

export const metadata: Metadata = { title: "Wochenreview" };
export const maxDuration = 60;

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });
const fmtTs = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default async function WeeklyReportPage({ params }: PageProps<"/berichte/woche/[weekStart]">) {
  const { weekStart } = await params;
  if (!isISODate(weekStart) || isoWeekday(weekStart) !== 1) notFound();
  const today = todayISO();
  const current = startOfWeek(today);
  if (weekStart > current) notFound();

  const { supabase } = await requireUser();
  const [stored, settings] = await Promise.all([getWeeklyReport(supabase, weekStart), getSettings(supabase)]);
  const r = stored?.data ?? buildWeeklyReport(await loadReportContext(supabase, today), weekStart);
  const s = r.stats;
  const p = r.previous;
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  return (
    <>
      <PageHeader
        title={`Wochenreview KW ${r.kw}`}
        subtitle={
          <>
            {formatDayMonth(r.weekStart)}–{formatDate(r.weekEnd)}
            {r.phase && ` · ${r.phase.name} (Woche ${r.phase.week}/${r.phase.total})`}
          </>
        }
      />
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/berichte/woche/${prevWeek}`} className="btn-ghost px-2 text-sm"><IconChevronLeft width={18} /> Vorwoche</Link>
        <Link href="/berichte" className="text-sm text-orange-400">Archiv</Link>
        {nextWeek <= current ? (
          <Link href={`/berichte/woche/${nextWeek}`} className="btn-ghost px-2 text-sm">Folgewoche <IconChevronRight width={18} /></Link>
        ) : <span className="w-24" />}
      </div>

      {!stored && (
        <div className="card mb-3 border-sky-900 bg-sky-950/30 text-sm text-sky-200">
          {weekStart === current
            ? "Vorschau der laufenden Woche – das endgültige Review wird am Montag automatisch gespeichert."
            : "Vorschau – für diese Woche ist noch kein Bericht gespeichert."}
        </div>
      )}
      {r.deload && (
        <div className="mb-3 inline-block rounded-lg bg-sky-950 px-2 py-1 text-xs text-sky-300">
          Entlastungswoche · {Math.round(r.deload * 100)} % Umfang
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Einheiten Soll/Ist" value={`${s.done}/${s.planned}`} sub={s.missed ? `${s.missed} verpasst` : s.cancelled ? `${s.cancelled} abgesagt` : undefined} />
        <StatTile label="Stunden" value={nf(s.hours, 1)} unit="h" delta={deltaPct(s.hours, p.hours)} sub={s.plannedMaxH ? `Soll ${nf(s.plannedMinH, 1)}–${nf(s.plannedMaxH, 1)} h` : undefined} />
        <StatTile label="Höhenmeter" value={nf(s.elevation)} unit="hm" delta={deltaPct(s.elevation, p.elevation)} />
        <StatTile label="Belastung (TRIMP)" value={nf(s.trimp)} delta={deltaPct(s.trimp, p.trimp)} />
      </div>
      <p className="mb-3 mt-1.5 text-[11px] text-zinc-600">Veränderung gegenüber der kompletten Vorwoche</p>

      <ReportInsights highlights={r.highlights} potentials={r.potentials} />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-1 font-semibold">Einheiten</h2>
          <SessionTable sessions={r.sessions} />
          <ExtraActivities items={r.extraActivities} />
        </section>
        <div className="space-y-3">
          <ZoneDistribution title="Intensitätsverteilung" zones={s.zoneSeconds} bounds={settings} />
          <section className="card">
            <h2 className="mb-2 font-semibold">Vergleich zur Vorwoche</h2>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-xs text-zinc-500">
                <tr><th className="py-1 text-left font-medium" /><th className="py-1 text-right font-medium">Vorwoche</th><th className="py-1 text-right font-medium">KW {r.kw}</th><th className="py-1 text-right font-medium">Δ</th></tr>
              </thead>
              <tbody>
                {([
                  ["Einheiten", `${p.done}/${p.planned}`, `${s.done}/${s.planned}`, null],
                  ["Stunden", nf(p.hours, 1), nf(s.hours, 1), deltaPct(s.hours, p.hours)],
                  ["Distanz (km)", nf(p.distanceKm), nf(s.distanceKm), deltaPct(s.distanceKm, p.distanceKm)],
                  ["Höhenmeter", nf(p.elevation), nf(s.elevation), deltaPct(s.elevation, p.elevation)],
                  ["Belastung", nf(p.trimp), nf(s.trimp), deltaPct(s.trimp, p.trimp)],
                  ["Aktivitäten", String(p.activities), String(s.activities), null],
                ] as [string, string, string, number | null][]).map(([k, a, b, d]) => (
                  <tr key={k} className="border-t border-zinc-800">
                    <td className="py-1.5 text-zinc-400">{k}</td>
                    <td className="py-1.5 text-right text-zinc-400">{a}</td>
                    <td className="py-1.5 text-right font-medium">{b}</td>
                    <td className="py-1.5 text-right text-xs text-zinc-400">{d == null ? "" : `${d > 0 ? "+" : ""}${d} %`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {weekStart < current && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          {stored && <span>Gespeichert am {fmtTs(stored.created_at)}</span>}
          <ActionButton
            action={regenerateWeeklyAction.bind(null, weekStart)}
            label={stored ? "Neu berechnen" : "Bericht speichern"}
            className="btn-ghost px-2 py-1 text-xs"
            confirmText={stored ? "Bericht mit den aktuellen Daten neu berechnen? Der bisherige Stand wird überschrieben." : undefined}
          />
        </div>
      )}
    </>
  );
}
