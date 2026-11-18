// Wochen- und Phasenberichte: Daten zusammenstellen und Regeln anwenden (reine Funktionen).
import { addDays, isWithin, isoWeekNumber, isoWeekday, startOfWeek, WEEKDAY_NAMES, type ISODate } from "@/lib/dates";
import { sessionStatus } from "@/lib/plan/status";
import { SESSION_TYPE_LABELS, type ActivitySummary, type DeloadWeek, type Phase, type PhaseKind, type PlannedSession, type SessionStatus, type SessionType } from "@/lib/plan/types";
import { intensitySplit, weekStats, type WeekStats } from "@/lib/metrics/weekly";
import { computeBadges, personalRecords, streaks, weekResults, type PersonalRecord } from "@/lib/metrics/achievements";

export const REPORT_VERSION = 1;

export interface ReportContext {
  sessions: PlannedSession[]; // alle Einheiten des Plans (inkl. Aktivitätsdatum)
  activities: ActivitySummary[]; // alle Aktivitäten seit Importbeginn
  phases: Phase[];
  deloads: DeloadWeek[];
  races: { id: string; name: string; start_date: ISODate; end_date: ISODate; location: string | null }[];
  ftp: number;
  weightKg: number;
  today: ISODate;
}

export interface ReportSession {
  date: ISODate;
  title: string;
  session_type: SessionType;
  status: SessionStatus;
  target_min: number | null;
  target_max: number | null;
  activity: { id: number; name: string; local_date: ISODate; moving_time_s: number; distance_m: number; elevation_gain_m: number } | null;
}

export interface WeeklyReportData {
  version: number;
  kind: "week";
  weekStart: ISODate;
  weekEnd: ISODate;
  kw: number;
  phase: { name: string; kind: PhaseKind; week: number; total: number } | null;
  deload: number | null;
  stats: WeekStats;
  previous: WeekStats;
  intensity: ReturnType<typeof intensitySplit>;
  sessions: ReportSession[];
  extraActivities: { id: number; name: string; sport_type: string; local_date: ISODate; moving_time_s: number }[];
  records: PersonalRecord[];
  badges: { icon: string; title: string }[];
  streak: number;
  highlights: string[];
  potentials: string[];
}

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });
const h = (x: number) => `${nf(x, 1)} h`;
const pct = (x: number, base: number) => Math.round(((x - base) / base) * 100);

/** Belastungssprung, ab dem gewarnt wird (TRIMP zur Vorwoche). */
export const LOAD_JUMP = 0.3;
/** Mindestanteil locker (Z1–Z2) in Grundlagen-/Trainingsphasen. */
export const EASY_TARGET = 75;
/** Ab diesem Anteil Z3 gilt die Woche als "graue Zone"-lastig. */
export const GREY_ZONE = 25;

// ---------------------------------------------------------------- Woche

export function buildWeeklyReport(ctx: ReportContext, weekStart: ISODate): WeeklyReportData {
  const { sessions, activities, phases, deloads, today } = ctx;
  const weekEnd = addDays(weekStart, 6);
  const stats = weekStats(weekStart, sessions, activities, today);
  const previous = weekStats(addDays(weekStart, -7), sessions, activities, today);
  const mid = addDays(weekStart, 3);
  const phase = phases.find((p) => isWithin(mid, p.start_date, p.end_date)) ?? null;
  const deload = phase?.kind === "training" ? deloads.find((d) => isWithin(mid, d.start_date, d.end_date)) ?? null : null;

  const weekSessions = sessions
    .filter((s) => isWithin(s.date, weekStart, weekEnd))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const rs: ReportSession[] = weekSessions.map((s) => ({
    date: s.date,
    title: s.title,
    session_type: s.session_type,
    status: sessionStatus(s, today),
    target_min: s.target_min,
    target_max: s.target_max,
    activity: s.activity
      ? {
          id: s.activity.id, name: s.activity.name, local_date: s.activity.local_date, moving_time_s: s.activity.moving_time_s,
          distance_m: s.activity.distance_m, elevation_gain_m: s.activity.elevation_gain_m,
        }
      : null,
  }));
  const matched = new Set(weekSessions.map((s) => s.activity_id).filter((x) => x != null));
  const extra = activities
    .filter((a) => isWithin(a.local_date, weekStart, weekEnd) && !matched.has(a.id))
    .map((a) => ({ id: a.id, name: a.name, sport_type: a.sport_type, local_date: a.local_date, moving_time_s: a.moving_time_s }));

  // Bestwerte, die in dieser Woche aufgestellt wurden (über alle Daten bis Wochenende)
  // Nur sinnvoll, wenn es vorher schon Aktivitäten gab (sonst ist alles "neu")
  const upToWeek = activities.filter((a) => a.local_date <= weekEnd);
  const hadHistory = activities.some((a) => a.local_date < weekStart);
  const records = hadHistory
    ? personalRecords(upToWeek, ctx.weightKg).filter((r) =>
        r.key.endsWith("week") ? r.date === weekStart : isWithin(r.date, weekStart, weekEnd),
      )
    : [];
  const planStart = phases[0]?.start_date ?? weekStart;
  const badges = computeBadges({
    sessions, activities, phases, races: ctx.races, deloads, ftp: ctx.ftp, today, planStart,
  })
    .filter((b) => b.earnedAt && isWithin(b.earnedAt, weekStart, weekEnd))
    .map((b) => ({ icon: b.icon, title: b.title }));
  const streak = streaks(weekResults(sessions, planStart, weekEnd < today ? weekEnd : today)).current;

  const data: WeeklyReportData = {
    version: REPORT_VERSION,
    kind: "week",
    weekStart,
    weekEnd,
    kw: isoWeekNumber(weekStart),
    phase: phase
      ? {
          name: phase.name, kind: phase.kind,
          week: Math.floor((Date.parse(weekStart) - Date.parse(startOfWeek(phase.start_date))) / (7 * 86400_000)) + 1,
          total: Math.ceil((Date.parse(phase.end_date) - Date.parse(startOfWeek(phase.start_date)) + 86400_000) / (7 * 86400_000)),
        }
      : null,
    deload: deload ? Number(deload.volume_factor) : null,
    stats,
    previous,
    intensity: intensitySplit(stats.zoneSeconds),
    sessions: rs,
    extraActivities: extra,
    records,
    badges,
    streak,
    highlights: [],
    potentials: [],
  };
  const missedRecent = recentMissedWeekdays(sessions, weekStart, today);
  const { highlights, potentials } = weeklyRules(data, missedRecent);
  return { ...data, highlights, potentials };
}

/** Wochentage mit verpassten Einheiten in den letzten 4 Wochen (inkl. Berichtswoche). */
function recentMissedWeekdays(sessions: PlannedSession[], weekStart: ISODate, today: ISODate): Map<number, number> {
  const from = addDays(weekStart, -21);
  const to = addDays(weekStart, 6);
  const m = new Map<number, number>();
  for (const s of sessions) {
    if (!isWithin(s.date, from, to) || sessionStatus(s, today) !== "missed") continue;
    const wd = isoWeekday(s.date);
    m.set(wd, (m.get(wd) ?? 0) + 1);
  }
  return m;
}

export function weeklyRules(r: WeeklyReportData, missedWeekdays: Map<number, number> = new Map()) {
  const good: string[] = [];
  const pot: string[] = [];
  const s = r.stats;
  const p = r.previous;
  const kind = r.phase?.kind;
  const restWeek = kind === "pause" || kind === "recovery" || kind === "race";
  const missed = r.sessions.filter((x) => x.status === "missed");
  const shifted = r.sessions.filter((x) => x.status === "shifted").length;

  // --- Soll/Ist
  if (s.planned > 0 && s.done === s.planned) good.push(`Plan zu 100 % erfüllt – alle ${s.planned} Einheiten erledigt.`);
  else if (s.planned > 0 && s.done / s.planned >= 0.8) good.push(`${s.done} von ${s.planned} Einheiten erledigt – starke Quote.`);
  if (missed.length) {
    const types = [...new Set(missed.map((x) => SESSION_TYPE_LABELS[x.session_type]))].join(", ");
    pot.push(`${missed.length} ${missed.length === 1 ? "Einheit" : "Einheiten"} verpasst (${types}).`);
    if (missed.some((x) => x.session_type === "strength"))
      pot.push("Krafttraining ausgelassen – gerade für Enduro (Rumpf, Arme, Griffkraft) einer der wichtigsten Bausteine. Notfalls auf 30 min kürzen statt streichen.");
    if (missed.some((x) => x.session_type === "mobility"))
      pot.push("Yoga & Mobility ausgelassen – schon 20 min helfen bei Regeneration und Beweglichkeit auf dem Bike.");
  }
  if (shifted >= 2) pot.push(`${shifted} Einheiten an anderen Tagen erledigt – passt der Wochenplan noch zu deinem Alltag?`);
  // Muster nur melden, wenn es auch diese Woche wieder passiert ist
  const thisWeekDays = new Set(missed.map((x) => isoWeekday(x.date)));
  const [wd, n] = [...missedWeekdays.entries()].filter(([d]) => thisWeekDays.has(d)).sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  if (n >= 2) pot.push(`Am ${WEEKDAY_NAMES[wd - 1]} fällt in den letzten 4 Wochen öfter etwas aus (${n}×) – Uhrzeit oder Tag tauschen?`);

  // --- Umfang
  if (s.plannedMaxH > 0) {
    if (s.hours >= s.plannedMinH && s.hours <= s.plannedMaxH * 1.1) good.push(`Umfang im Zielbereich: ${h(s.hours)} (Soll ${nf(s.plannedMinH, 1)}–${h(s.plannedMaxH)}).`);
    else if (s.hours < s.plannedMinH) pot.push(`Umfang ${h(s.plannedMinH - s.hours)} unter dem Soll (${h(s.hours)} statt mind. ${h(s.plannedMinH)}).`);
    else pot.push(`Umfang deutlich über Soll (${h(s.hours)} statt max. ${h(s.plannedMaxH)})${r.deload ? " – in einer Entlastungswoche zählt Erholung mehr als Kilometer." : " – auf ausreichende Erholung achten."}`);
  }
  if (r.deload && s.plannedMaxH > 0 && s.hours <= s.plannedMaxH * 1.1) good.push(`Entlastungswoche eingehalten (${Math.round(r.deload * 100)} % Umfang) – so kommt die Anpassung an.`);

  // --- Belastung
  if (p.trimp > 0 && s.trimp > p.trimp * (1 + LOAD_JUMP) && !restWeek)
    pot.push(`Belastung +${pct(s.trimp, p.trimp)} % zur Vorwoche – Sprünge über ${LOAD_JUMP * 100} % erhöhen das Überlastungsrisiko.`);
  if (p.trimp > 0 && s.trimp >= p.trimp * 0.9 && s.trimp <= p.trimp * (1 + LOAD_JUMP) && !r.deload && s.trimp > 0)
    good.push(`Belastung stabil bis moderat gesteigert (${pct(s.trimp, p.trimp) >= 0 ? "+" : ""}${pct(s.trimp, p.trimp)} %).`);

  // --- Intensität
  const it = r.intensity;
  if (it && !restWeek) {
    if (it.easy >= EASY_TARGET) good.push(`Grundlage sitzt: ${it.easy} % der Zeit locker in Z1–Z2.`);
    else if (kind === "training") pot.push(`Nur ${it.easy} % locker (Z1–Z2) – Ziel sind rund ${EASY_TARGET} %. Lockere Einheiten wirklich locker fahren.`);
    if (it.moderate >= GREY_ZONE) pot.push(`${it.moderate} % in Z3 („graue Zone“) – zu hart für Grundlage, zu locker für Reize. Klarer trennen.`);
    const hardMin = Math.round((s.zoneSeconds[3] + s.zoneSeconds[4]) / 60);
    const ivDone = r.sessions.some((x) => x.session_type === "intervals" && (x.status === "done" || x.status === "shifted"));
    if (ivDone && hardMin >= 10) good.push(`Intensität gesetzt: ${hardMin} min in Z4–Z5.`);
    else if (ivDone && hardMin < 5 && s.zoneSeconds.some((z) => z > 0))
      pot.push("Intervalle erledigt, aber kaum Zeit in Z4–Z5 – Intervalle dürfen richtig wehtun.");
  }
  const noHr = r.sessions.filter((x) => x.activity && ["intervals", "enduro", "gravel"].includes(x.session_type)).length > 0 && !it;
  if (noHr) pot.push("Keine Herzfrequenzdaten – mit Brustgurt/Uhr werden Zonen und Belastung genauer.");

  // --- Höhenmeter
  if (s.elevation >= 1500 && s.elevation > p.elevation) good.push(`${nf(s.elevation)} Höhenmeter – gute Vorbereitung auf die Enduro-Anstiege.`);

  // --- Erfolge
  for (const rec of r.records.slice(0, 3)) good.push(`Neuer Bestwert: ${rec.label} – ${rec.display}${rec.extra ? ` (${rec.extra})` : ""}.`);
  if (r.badges.length) good.push(`${r.badges.length === 1 ? "Badge" : "Badges"} verdient: ${r.badges.map((b) => `${b.icon} ${b.title}`).join(", ")}.`);
  if (r.streak >= 2) good.push(`Serie: ${r.streak} Wochen in Folge den Plan erfüllt.`);

  if (r.extraActivities.length && !good.some((g) => g.includes("zusätzlich")))
    good.push(`${r.extraActivities.length} zusätzliche ${r.extraActivities.length === 1 ? "Aktivität" : "Aktivitäten"} außerhalb des Plans.`);

  if (s.planned === 0 && s.activities === 0) good.push(restWeek || kind === undefined ? "Ruhewoche – Erholung ist Teil des Trainings." : "Keine Einheiten geplant.");
  if (!pot.length) pot.push("Keine Auffälligkeiten – genau so weitermachen.");
  if (!good.length) good.push("Jede Woche ist ein neuer Anfang – nächste Woche zählt.");
  return { highlights: good, potentials: pot };
}

// ---------------------------------------------------------------- Phase

export interface PhaseReportData {
  version: number;
  kind: "phase";
  phase: { id: string; name: string; kind: PhaseKind; start_date: ISODate; end_date: ISODate; color: string; focus: string | null };
  weeks: { weekStart: ISODate; kw: number; planned: number; done: number; hours: number; plannedMinH: number; plannedMaxH: number; trimp: number; elevation: number; state: string }[];
  totals: Omit<WeekStats, "weekStart" | "weekEnd">;
  completion: number;
  fulfilledWeeks: number;
  missedByType: Partial<Record<SessionType, number>>;
  intensity: ReturnType<typeof intensitySplit>;
  records: PersonalRecord[];
  badges: { icon: string; title: string }[];
  next: { name: string; start_date: ISODate; focus: string | null } | null;
  highlights: string[];
  potentials: string[];
}

export function buildPhaseReport(ctx: ReportContext, phaseId: string): PhaseReportData {
  const { sessions, activities, phases, today } = ctx;
  const phase = phases.find((p) => p.id === phaseId);
  if (!phase) throw new Error("Phase nicht gefunden");
  const inPhase = (d: ISODate) => isWithin(d, phase.start_date, phase.end_date);
  const pSessions = sessions.filter((s) => inPhase(s.date));
  const pActs = activities.filter((a) => inPhase(a.local_date));

  const weekStarts: ISODate[] = [];
  for (let w = startOfWeek(phase.start_date); w <= phase.end_date; w = addDays(w, 7)) weekStarts.push(w);
  const results = weekResults(pSessions, phase.start_date, phase.end_date < today ? phase.end_date : today);
  const weeks = weekStarts.map((w) => {
    const st = weekStats(w, pSessions, pActs, today);
    return {
      weekStart: w, kw: isoWeekNumber(w), planned: st.planned, done: st.done, hours: st.hours,
      plannedMinH: st.plannedMinH, plannedMaxH: st.plannedMaxH, trimp: st.trimp, elevation: st.elevation,
      state: results.find((r) => r.weekStart === w)?.state ?? "none",
    };
  });

  // Gesamtwerte: Summe der Wochen (nur Einheiten/Aktivitäten innerhalb der Phase)
  const totals = sumWeeks(weeks.map((w) => weekStats(w.weekStart, pSessions, pActs, today)));

  const missedByType: Partial<Record<SessionType, number>> = {};
  for (const s of pSessions) if (sessionStatus(s, today) === "missed") missedByType[s.session_type] = (missedByType[s.session_type] ?? 0) + 1;
  const records = personalRecords(activities.filter((a) => a.local_date <= phase.end_date), ctx.weightKg).filter((r) =>
    r.key.endsWith("week") ? inPhase(r.date) || inPhase(addDays(r.date, 6)) : inPhase(r.date),
  );
  const planStart = phases[0]?.start_date ?? phase.start_date;
  const badges = computeBadges({ sessions, activities, phases, races: ctx.races, deloads: ctx.deloads, ftp: ctx.ftp, today, planStart })
    .filter((b) => b.earnedAt && inPhase(b.earnedAt))
    .map((b) => ({ icon: b.icon, title: b.title }));
  const next = phases.filter((p) => p.start_date > phase.end_date && p.kind !== "pause").sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const data: PhaseReportData = {
    version: REPORT_VERSION,
    kind: "phase",
    phase: { id: phase.id, name: phase.name, kind: phase.kind, start_date: phase.start_date, end_date: phase.end_date, color: phase.color, focus: phase.focus },
    weeks,
    totals,
    completion: totals.planned ? totals.done / totals.planned : 0,
    fulfilledWeeks: weeks.filter((w) => w.state === "fulfilled").length,
    missedByType,
    intensity: intensitySplit(totals.zoneSeconds),
    records,
    badges,
    next: next ? { name: next.name, start_date: next.start_date, focus: next.focus } : null,
    highlights: [],
    potentials: [],
  };
  return { ...data, ...phaseRules(data, ctx.deloads) };
}

function sumWeeks(ws: WeekStats[]): PhaseReportData["totals"] {
  const z: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const t = { planned: 0, done: 0, missed: 0, cancelled: 0, plannedMinH: 0, plannedMaxH: 0, hours: 0, elevation: 0, distanceKm: 0, trimp: 0, activities: 0 };
  for (const w of ws) {
    for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += w[k];
    w.zoneSeconds.forEach((x, i) => (z[i] += x));
  }
  return { ...t, zoneSeconds: z };
}

export function phaseRules(r: PhaseReportData, deloads: DeloadWeek[] = []) {
  const good: string[] = [];
  const pot: string[] = [];
  const t = r.totals;
  const c = Math.round(r.completion * 100);
  const isRest = r.phase.kind === "pause" || r.phase.kind === "recovery";
  const isDeload = (w: ISODate) => deloads.some((d) => isWithin(addDays(w, 3), d.start_date, d.end_date));

  if (t.planned > 0) {
    if (c >= 90) good.push(`Sehr konsequent: ${c} % der Einheiten erledigt (${t.done}/${t.planned}).`);
    else if (c >= 75) good.push(`Solide: ${c} % der Einheiten erledigt (${t.done}/${t.planned}).`);
    else pot.push(`Nur ${c} % der Einheiten erledigt (${t.done}/${t.planned}) – Ursachen für Ausfälle anschauen.`);
  }
  const planWeeks = r.weeks.filter((w) => w.planned > 0).length;
  if (planWeeks > 0 && r.fulfilledWeeks / planWeeks >= 0.5) good.push(`${r.fulfilledWeeks} von ${planWeeks} Wochen komplett nach Plan.`);
  const topMissed = (Object.entries(r.missedByType) as [SessionType, number][]).sort((a, b) => b[1] - a[1])[0];
  if (topMissed && topMissed[1] >= 2) pot.push(`Am häufigsten verpasst: ${SESSION_TYPE_LABELS[topMissed[0]]} (${topMissed[1]}×).`);

  if (t.plannedMaxH > 0) {
    if (t.hours >= t.plannedMinH && t.hours <= t.plannedMaxH * 1.1) good.push(`Gesamtumfang im Plan: ${h(t.hours)} (Soll ${nf(t.plannedMinH, 0)}–${h(t.plannedMaxH)}).`);
    else if (t.hours < t.plannedMinH) pot.push(`Gesamtumfang ${h(t.plannedMinH - t.hours)} unter dem Soll (${h(t.hours)}).`);
    else pot.push(`Gesamtumfang über Soll (${h(t.hours)} statt max. ${h(t.plannedMaxH)})${r.phase.kind === "taper" ? " – im Tapering zählt Frische." : "."}`);
  }

  // Progression: erste vs. letzte reguläre Woche
  const regular = r.weeks.filter((w) => w.hours > 0 && !isDeload(w.weekStart));
  if (r.phase.kind === "training" && regular.length >= 3) {
    const first = regular[0].hours;
    const last = regular[regular.length - 1].hours;
    if (last > first * 1.1) good.push(`Umfang gesteigert: von ${h(first)} auf ${h(last)} pro Woche.`);
  }
  // Belastungssprünge
  let jumps = 0;
  for (let i = 1; i < r.weeks.length; i++) {
    const a = r.weeks[i - 1].trimp;
    const b = r.weeks[i].trimp;
    if (a > 0 && b > a * (1 + LOAD_JUMP)) jumps++;
  }
  if (jumps >= 2 && !isRest) pot.push(`${jumps}× Belastungssprung über ${LOAD_JUMP * 100} % zur Vorwoche – gleichmäßiger steigern.`);

  const it = r.intensity;
  if (it && !isRest) {
    if (it.easy >= EASY_TARGET) good.push(`Gute Intensitätsverteilung: ${it.easy} % locker, ${it.hard} % hart.`);
    else if (r.phase.kind === "training") pot.push(`Nur ${it.easy} % locker (Z1–Z2) – mehr echte Grundlage einbauen.`);
    if (it.moderate >= GREY_ZONE) pot.push(`${it.moderate} % in Z3 – viel „graue Zone“.`);
  }
  if (t.elevation >= 10000) good.push(`${nf(t.elevation)} Höhenmeter in dieser Phase.`);
  for (const rec of r.records) good.push(`Bestwert: ${rec.label} – ${rec.display}${rec.extra ? ` (${rec.extra})` : ""}.`);
  if (r.badges.length) good.push(`Badges: ${r.badges.map((b) => `${b.icon} ${b.title}`).join(", ")}.`);

  if (!pot.length) pot.push("Keine Auffälligkeiten – starke Phase.");
  if (!good.length) good.push("Phase abgeschlossen – jetzt zählt die nächste.");
  return { highlights: good, potentials: pot };
}

/** Wochen, für die ein Bericht fällig ist: abgeschlossene Wochen ab Planstart. */
export function dueWeeks(planStart: ISODate, today: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const lastComplete = addDays(startOfWeek(today), -7);
  for (let w = startOfWeek(planStart); w <= lastComplete; w = addDays(w, 7)) out.push(w);
  return out;
}

/** Phasen, für die ein Bericht fällig ist (abgeschlossen, keine Pause). */
export function duePhases(phases: Phase[], today: ISODate): Phase[] {
  return phases.filter((p) => p.end_date < today && p.kind !== "pause");
}
