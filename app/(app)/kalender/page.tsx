import type { Metadata } from "next";
import Link from "next/link";
import {
  addDays, addMonths, eachDay, endOfMonth, endOfWeek, formatDayMonth, formatLong, formatMonth, isISODate,
  isWithin, isoWeekNumber, startOfMonth, startOfWeek, todayISO, WEEKDAY_SHORT, type ISODate,
} from "@/lib/dates";
import { countSessions, getDeloads, getOverrides, getPhases, getRaces, getSessions, getSettings, requireUser } from "@/lib/data";
import { phaseForDate } from "@/lib/plan/generate";
import { sessionStatus } from "@/lib/plan/status";
import { TYPE_COLORS } from "@/lib/plan/style";
import { PHASE_KIND_LABELS, SESSION_TYPE_LABELS, SESSION_TYPES, type DeloadWeek, type Phase, type PlannedSession, type Race } from "@/lib/plan/types";
import { PageHeader } from "@/components/page-header";
import { SessionCard } from "@/components/session-card";
import { GeneratePlanButton } from "@/components/generate-plan-button";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";
import { IcsHint } from "./ics-hint";

export const metadata: Metadata = { title: "Kalender" };

type View = "monat" | "woche";

export default async function KalenderPage({ searchParams }: PageProps<"/kalender">) {
  const sp = await searchParams;
  const view: View = sp.ansicht === "woche" ? "woche" : "monat";
  const today = todayISO();
  const anchor: ISODate = typeof sp.datum === "string" && isISODate(sp.datum) ? sp.datum : today;

  const { supabase } = await requireUser();
  const [phases, races, deloads, overrides, total, settings] = await Promise.all([
    getPhases(supabase),
    getRaces(supabase),
    getDeloads(supabase),
    getOverrides(supabase),
    countSessions(supabase),
    getSettings(supabase),
  ]);
  const overrideKeys = new Set(overrides.map((o) => o.slot_key));

  const range =
    view === "monat"
      ? { from: startOfWeek(startOfMonth(anchor)), to: endOfWeek(endOfMonth(anchor)) }
      : { from: startOfWeek(anchor), to: endOfWeek(anchor) };
  const sessions = await getSessions(supabase, range.from, range.to);

  const href = (v: View, d: ISODate) => `/kalender?ansicht=${v}&datum=${d}`;
  const prev = view === "monat" ? addMonths(anchor, -1) : addDays(anchor, -7);
  const next = view === "monat" ? addMonths(anchor, 1) : addDays(anchor, 7);
  const title = view === "monat" ? formatMonth(anchor) : `KW ${isoWeekNumber(anchor)}`;
  const subtitle =
    view === "woche" ? `${formatDayMonth(range.from)} – ${formatDayMonth(range.to)}` : undefined;

  return (
    <>
      <PageHeader
        title="Kalender"
        action={
          <div className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-0.5 text-sm">
            {(["monat", "woche"] as const).map((v) => (
              <Link
                key={v}
                href={href(v, anchor)}
                className={`rounded-lg px-3 py-1.5 ${view === v ? "bg-zinc-700 font-semibold" : "text-zinc-400"}`}
              >
                {v === "monat" ? "Monat" : "Woche"}
              </Link>
            ))}
          </div>
        }
      />

      {total === 0 && (
        <div className="card mb-4 border-orange-900 bg-orange-950/30">
          <p className="mb-3 text-sm">
            Es sind noch keine Einheiten angelegt. Erzeuge den Plan einmalig aus Phasen und Standardwoche.
          </p>
          <GeneratePlanButton />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Link href={href(view, prev)} className="btn-ghost p-2" aria-label="Zurück">
          <IconChevronLeft />
        </Link>
        <div className="text-center">
          <div className="text-lg font-semibold capitalize">{title}</div>
          {subtitle && <div className="text-xs text-zinc-400">{subtitle}</div>}
        </div>
        <Link href={href(view, next)} className="btn-ghost p-2" aria-label="Weiter">
          <IconChevronRight />
        </Link>
      </div>
      <div className="mb-4 flex justify-center">
        <Link href={href(view, today)} className="btn-secondary px-3 py-1 text-xs">
          Heute
        </Link>
      </div>

      {view === "monat" ? (
        <MonthGrid anchor={anchor} from={range.from} to={range.to} today={today} sessions={sessions} phases={phases} races={races} />
      ) : (
        <WeekList
          from={range.from}
          today={today}
          sessions={sessions}
          phases={phases}
          races={races}
          deloads={deloads}
          overrideKeys={overrideKeys}
        />
      )}

      <Legend phases={phases.filter((p) => p.end_date >= range.from && p.start_date <= range.to)} />
      <IcsHint token={settings.ics_token} />
    </>
  );
}

function MonthGrid(props: {
  anchor: ISODate; from: ISODate; to: ISODate; today: ISODate;
  sessions: PlannedSession[]; phases: Phase[]; races: Race[];
}) {
  const { anchor, from, to, today, sessions, phases, races } = props;
  const month = anchor.slice(0, 7);
  const days = eachDay(from, to);
  return (
    <div className="card p-2">
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-zinc-500">
        {WEEKDAY_SHORT.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const phase = phaseForDate(phases, d);
          const race = races.find((r) => isWithin(d, r.start_date, r.end_date));
          const daySessions = sessions.filter((s) => s.date === d);
          const inMonth = d.slice(0, 7) === month;
          return (
            <Link
              key={d}
              href={`/kalender?ansicht=woche&datum=${d}`}
              className={`relative flex aspect-square min-h-12 flex-col rounded-lg p-1 text-left sm:aspect-[4/3] ${
                inMonth ? "" : "opacity-35"
              } ${race ? "ring-2 ring-yellow-400" : ""}`}
              style={{ background: phase ? `${phase.color}1f` : "transparent" }}
            >
              {phase && <span className="absolute inset-x-1 top-0 h-0.5 rounded" style={{ background: phase.color }} />}
              <span
                className={`text-xs font-semibold ${
                  d === today ? "flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-zinc-950" : ""
                }`}
              >
                {Number(d.slice(8))}
              </span>
              {race && <span className="truncate text-[9px] font-bold text-yellow-300">🏁 Rennen</span>}
              <div className="mt-auto flex flex-wrap gap-0.5">
                {daySessions
                  .filter((s) => s.session_type !== "race")
                  .map((s) => {
                    const st = sessionStatus(s, today);
                    return (
                      <span
                        key={s.id}
                        title={s.title}
                        className={`h-2 w-2 rounded-full ${st === "cancelled" ? "opacity-30" : ""} ${
                          st === "missed" ? "ring-1 ring-red-500" : ""
                        }`}
                        style={{ background: TYPE_COLORS[s.session_type] }}
                      />
                    );
                  })}
              </div>
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
        {SESSION_TYPES.filter((t) => t !== "race").map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[t] }} />
            {SESSION_TYPE_LABELS[t]}
          </span>
        ))}
      </div>
    </div>
  );
}

function WeekList(props: {
  from: ISODate; today: ISODate; sessions: PlannedSession[]; phases: Phase[]; races: Race[];
  deloads: DeloadWeek[]; overrideKeys: Set<string>;
}) {
  const { from, today, sessions, phases, races, deloads, overrideKeys } = props;
  const deload = deloads.find((w) => isWithin(addDays(from, 3), w.start_date, w.end_date));
  return (
    <div className="space-y-3">
      {deload && (
        <div className="rounded-xl border border-sky-900 bg-sky-950/40 px-3 py-2 text-sm text-sky-200">
          Entlastungswoche – Umfang {Math.round(deload.volume_factor * 100)} %
        </div>
      )}
      {eachDay(from, addDays(from, 6)).map((d) => {
        const phase = phaseForDate(phases, d);
        const race = races.find((r) => isWithin(d, r.start_date, r.end_date));
        const daySessions = sessions.filter((s) => s.date === d);
        return (
          <section
            key={d}
            className={`card ${d === today ? "border-orange-600" : ""} ${race ? "border-yellow-500 bg-yellow-950/20" : ""}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className={`font-semibold ${d === today ? "text-orange-400" : ""}`}>{formatLong(d).replace(/ \d{4}$/, "")}</h2>
              {phase && (
                <span className="badge" style={{ background: `${phase.color}33`, color: phase.color }}>
                  {phase.kind === "training" ? phase.name.split(" – ")[0] : PHASE_KIND_LABELS[phase.kind]}
                </span>
              )}
            </div>
            {daySessions.length === 0 ? (
              <p className="text-sm text-zinc-500">{phase?.kind === "pause" ? "Pause" : "Ruhetag"}</p>
            ) : (
              <div className="space-y-2">
                {daySessions.map((s) => (
                  <SessionCard key={s.id} session={s} status={sessionStatus(s, today)} hasOverride={overrideKeys.has(s.slot_key)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Legend({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {phases.map((p) => (
        <span key={p.id} className="badge" style={{ background: `${p.color}26`, color: p.color }}>
          {p.name}
        </span>
      ))}
    </div>
  );
}
