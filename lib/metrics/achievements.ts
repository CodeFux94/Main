// Erfolge: Serien, Bestwerte, Badges, Phasen – reine Funktionen, aus den Daten berechnet.
import { addDays, isWithin, startOfWeek, type ISODate } from "@/lib/dates";
import { sessionStatus } from "@/lib/plan/status";
import type { ActivitySummary, DeloadWeek, Phase, PlannedSession, Race } from "@/lib/plan/types";

const RIDES = ["Ride", "MountainBikeRide", "EMountainBikeRide", "GravelRide", "EBikeRide", "VirtualRide"];
export const isRide = (a: { sport_type: string }) => RIDES.includes(a.sport_type);

// ---------------------------------------------------------------- Serien

export type WeekState = "fulfilled" | "partial" | "open" | "none";

export interface WeekResult {
  weekStart: ISODate;
  planned: number;
  done: number;
  state: WeekState;
}

/**
 * Bewertet jede Woche ab `from`:
 * - fulfilled: alle nicht abgesagten Einheiten erledigt (verschoben zählt)
 * - partial:   Woche vorbei, mindestens eine Einheit verpasst
 * - open:      laufende Woche, noch nicht erfüllt
 * - none:      keine Einheiten geplant (z. B. Pause) – unterbricht keine Serie
 */
export function weekResults(sessions: PlannedSession[], from: ISODate, today: ISODate): WeekResult[] {
  const out: WeekResult[] = [];
  const current = startOfWeek(today);
  for (let w = startOfWeek(from); w <= current; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const ses = sessions.filter((s) => isWithin(s.date, w, end) && !s.cancelled);
    const done = ses.filter((s) => ["done", "shifted"].includes(sessionStatus(s, today))).length;
    const state: WeekState =
      ses.length === 0 ? "none" : done === ses.length ? "fulfilled" : w === current ? "open" : "partial";
    out.push({ weekStart: w, planned: ses.length, done, state });
  }
  return out;
}

export interface Streaks {
  current: number;
  longest: number;
  /** Datum (Wochenende), an dem eine Serie von n Wochen erstmals erreicht wurde */
  reachedAt: (n: number) => ISODate | null;
}

export function streaks(weeks: WeekResult[]): Streaks {
  let run = 0;
  let longest = 0;
  const reached = new Map<number, ISODate>();
  for (const w of weeks) {
    if (w.state === "fulfilled") {
      run++;
      longest = Math.max(longest, run);
      if (!reached.has(run)) reached.set(run, addDays(w.weekStart, 6));
    } else if (w.state === "partial") {
      run = 0;
    }
    // "none" und "open" unterbrechen nicht
  }
  return { current: run, longest, reachedAt: (n) => reached.get(n) ?? null };
}

// ---------------------------------------------------------------- Bestwerte

export interface PersonalRecord {
  key: string;
  label: string;
  value: number;
  display: string;
  date: ISODate;
  activityId?: number;
  name?: string;
  /** Zusatzwert, z. B. W/kg */
  extra?: string;
}

const nf = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d });
const hm = (min: number) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, "0")} h`;

function best<T>(items: T[], score: (x: T) => number | null): T | undefined {
  let top: T | undefined;
  let topScore = -Infinity;
  for (const x of items) {
    const s = score(x);
    if (s != null && s > topScore) {
      top = x;
      topScore = s;
    }
  }
  return top;
}

/** Mindestdauer, damit eine Leistung als Bestwert zählt (kurze Sprints verzerren). */
export const POWER_MIN_SECONDS = 20 * 60;

export function personalRecords(activities: ActivitySummary[], weightKg: number): PersonalRecord[] {
  const rides = activities.filter(isRide);
  const out: PersonalRecord[] = [];
  const fromAct = (key: string, label: string, a: ActivitySummary | undefined, value: number, display: string) => {
    if (a && value > 0) out.push({ key, label, value, display, date: a.local_date, activityId: a.id, name: a.name });
  };

  const longest = best(rides, (a) => a.moving_time_s);
  fromAct("longest_ride", "Längste Fahrt", longest, longest?.moving_time_s ?? 0, hm((longest?.moving_time_s ?? 0) / 60));
  const farthest = best(rides, (a) => a.distance_m);
  fromAct("farthest_ride", "Weiteste Fahrt", farthest, farthest?.distance_m ?? 0, `${nf((farthest?.distance_m ?? 0) / 1000, 1)} km`);
  const climb = best(activities, (a) => a.elevation_gain_m);
  fromAct("most_elevation", "Meiste Höhenmeter", climb, climb?.elevation_gain_m ?? 0, `${nf(climb?.elevation_gain_m ?? 0)} hm`);
  const power = best(
    rides.filter((a) => a.moving_time_s >= POWER_MIN_SECONDS),
    (a) => a.weighted_avg_watts ?? a.avg_watts,
  );
  const watts = power ? (power.weighted_avg_watts ?? power.avg_watts ?? 0) : 0;
  fromAct("best_power", "Beste Leistung (≥ 20 min)", power, watts, `${nf(watts)} W`);
  const pw = out.find((r) => r.key === "best_power");
  if (pw) pw.extra = `${nf(watts / weightKg, 2)} W/kg`;

  // Beste Woche (Stunden / Höhenmeter)
  const byWeek = new Map<ISODate, { h: number; hm: number }>();
  for (const a of activities) {
    const w = startOfWeek(a.local_date);
    const e = byWeek.get(w) ?? { h: 0, hm: 0 };
    e.h += a.moving_time_s / 3600;
    e.hm += a.elevation_gain_m;
    byWeek.set(w, e);
  }
  const weeks = [...byWeek.entries()];
  const wh = best(weeks, ([, v]) => v.h);
  if (wh && wh[1].h > 0) out.push({ key: "biggest_week", label: "Umfangreichste Woche", value: wh[1].h, display: hm(wh[1].h * 60), date: wh[0] });
  const whm = best(weeks, ([, v]) => v.hm);
  if (whm && whm[1].hm > 0) out.push({ key: "climbing_week", label: "Meiste Höhenmeter (Woche)", value: whm[1].hm, display: `${nf(whm[1].hm)} hm`, date: whm[0] });
  return out;
}

// ---------------------------------------------------------------- Badges

export type BadgeGroup = "Einheiten" | "Serien" | "Umfang" | "Höhenmeter" | "Leistung" | "Meilensteine";

export interface Badge {
  key: string;
  group: BadgeGroup;
  icon: string;
  title: string;
  description: string;
  earnedAt: ISODate | null;
  /** Fortschritt für noch nicht verdiente Badges */
  progress?: { current: number; target: number; unit?: string };
  /** Hinweis statt Fortschritt (z. B. "läuft bis 20.12.") */
  note?: string;
}

interface BadgeInput {
  sessions: PlannedSession[];
  activities: ActivitySummary[];
  phases: Phase[];
  races: Race[];
  deloads: DeloadWeek[];
  ftp: number;
  today: ISODate;
  /** Beginn der Wertung für Summen (Planstart) */
  planStart: ISODate;
}

/** Datum, an dem eine kumulierte Summe die Schwelle erreicht (chronologisch). */
function crossing<T>(items: T[], date: (x: T) => ISODate, value: (x: T) => number, threshold: number) {
  let sum = 0;
  for (const x of [...items].sort((a, b) => date(a).localeCompare(date(b)))) {
    sum += value(x);
    if (sum >= threshold) return { at: date(x), total: null as number | null };
  }
  return { at: null, total: sum };
}

export function computeBadges(input: BadgeInput): Badge[] {
  const { sessions, activities, phases, races, deloads, ftp, today, planStart } = input;
  const done = sessions
    .filter((s) => ["done", "shifted"].includes(sessionStatus(s, today)))
    .map((s) => ({ date: s.activity_date ?? s.date }));
  const planActs = activities.filter((a) => a.local_date >= planStart);
  const weeks = weekResults(sessions, planStart, today);
  const st = streaks(weeks);
  const badges: Badge[] = [];

  const threshold = (
    key: string, group: BadgeGroup, icon: string, title: string, description: string,
    res: { at: ISODate | null; total: number | null }, target: number, unit?: string,
  ) =>
    badges.push({
      key, group, icon, title, description, earnedAt: res.at,
      progress: res.at ? undefined : { current: Math.round((res.total ?? 0) * 10) / 10, target, unit },
    });

  // Einheiten
  for (const [n, icon, title] of [[1, "🚀", "Los geht's"], [25, "💪", "25 Einheiten"], [50, "🔥", "50 Einheiten"], [100, "🏅", "100 Einheiten"]] as const) {
    threshold(`sessions_${n}`, "Einheiten", icon, title, n === 1 ? "Erste Einheit erledigt" : `${n} geplante Einheiten erledigt`,
      crossing(done, (x) => x.date, () => 1, n), n, "Einheiten");
  }
  // Serien
  for (const [n, icon] of [[1, "✅"], [4, "📆"], [8, "⛓️"], [12, "🏆"]] as const) {
    const at = st.reachedAt(n);
    badges.push({
      key: `streak_${n}`, group: "Serien", icon,
      title: n === 1 ? "Volle Woche" : `${n} Wochen am Stück`,
      description: n === 1 ? "Eine Woche mit allen geplanten Einheiten" : `${n} Wochen in Folge den Plan erfüllt`,
      earnedAt: at,
      progress: at ? undefined : { current: st.current, target: n, unit: "Wochen" },
    });
  }
  // Umfang (Stunden seit Planstart)
  for (const [n, icon] of [[50, "⏱️"], [100, "⌛"], [250, "🕰️"]] as const) {
    threshold(`hours_${n}`, "Umfang", icon, `${n} Stunden`, `${n} Stunden Training seit Planstart`,
      crossing(planActs, (a) => a.local_date, (a) => a.moving_time_s / 3600, n), n, "h");
  }
  // Höhenmeter (seit Planstart)
  for (const [n, icon] of [[10000, "⛰️"], [25000, "🏔️"], [50000, "🗻"], [100000, "🌋"]] as const) {
    threshold(`elevation_${n}`, "Höhenmeter", icon, `${(n / 1000).toLocaleString("de-DE")}.000 hm`, `${n.toLocaleString("de-DE")} Höhenmeter seit Planstart`,
      crossing(planActs, (a) => a.local_date, (a) => a.elevation_gain_m, n), n, "hm");
  }
  const first = (pred: (a: ActivitySummary) => boolean) =>
    [...planActs].sort((a, b) => a.local_date.localeCompare(b.local_date)).find(pred)?.local_date ?? null;
  badges.push({ key: "day_1000hm", group: "Höhenmeter", icon: "🧗", title: "1.000 hm am Stück", description: "Eine Aktivität mit mindestens 1.000 Höhenmetern", earnedAt: first((a) => a.elevation_gain_m >= 1000) });
  badges.push({ key: "ride_3h", group: "Umfang", icon: "🚵", title: "3 Stunden im Sattel", description: "Eine Fahrt von mindestens 3 Stunden", earnedAt: first((a) => isRide(a) && a.moving_time_s >= 3 * 3600) });
  badges.push({ key: "ride_4h", group: "Umfang", icon: "🦾", title: "4 Stunden im Sattel", description: "Eine Fahrt von mindestens 4 Stunden (Enduro-Renntag-Niveau)", earnedAt: first((a) => isRide(a) && a.moving_time_s >= 4 * 3600) });
  // Leistung
  badges.push({
    key: "power_ftp", group: "Leistung", icon: "⚡", title: "Schwellenfahrt",
    description: `Mindestens 20 min mit gewichteter Ø-Leistung ≥ FTP (${ftp} W)`,
    earnedAt: first((a) => isRide(a) && a.moving_time_s >= POWER_MIN_SECONDS && (a.weighted_avg_watts ?? 0) >= ftp),
  });
  // Meilensteine: Entlastungswoche, Phasen, Rennen
  const deloadDone = deloads
    .map((d) => weeks.find((w) => w.weekStart === startOfWeek(d.start_date)))
    .find((w) => w?.state === "fulfilled");
  badges.push({ key: "deload", group: "Meilensteine", icon: "🧘", title: "Clever entlastet", description: "Eine Entlastungswoche komplett durchgezogen", earnedAt: deloadDone ? addDays(deloadDone.weekStart, 6) : null });
  for (const p of phaseSummaries(sessions, activities, phases, today).filter((x) => x.phase.kind === "training")) {
    badges.push({
      key: `phase_${p.phase.id}`, group: "Meilensteine", icon: "🎯", title: `${p.phase.name.split(" – ")[0]} geschafft`,
      description: `${p.phase.name}: mindestens 80 % der Einheiten erledigt`,
      earnedAt: p.finished && p.completion >= 0.8 ? p.phase.end_date : null,
      // laufende/kommende Phase: noch nicht entschieden → Hinweis statt Fortschritt
      progress: p.finished && p.completion < 0.8 ? { current: Math.round(p.completion * 100), target: 80, unit: "%" } : undefined,
      note: p.finished ? undefined : p.running ? `läuft bis ${p.phase.end_date.slice(8, 10)}.${p.phase.end_date.slice(5, 7)}. – bisher ${Math.round(p.completion * 100)} %` : `ab ${p.phase.start_date.slice(8, 10)}.${p.phase.start_date.slice(5, 7)}.${p.phase.start_date.slice(0, 4)}`,
    });
  }
  for (const r of races) {
    const raceDone = sessions
      .filter((s) => s.race_id === r.id && ["done", "shifted"].includes(sessionStatus(s, today)))
      .map((s) => s.activity_date ?? s.date)
      .sort()[0];
    badges.push({ key: `race_${r.id}`, group: "Meilensteine", icon: "🏁", title: r.name.replace("Enduro One ", ""), description: `${r.name} gefahren`, earnedAt: raceDone ?? null });
  }
  return badges;
}

// ---------------------------------------------------------------- Phasen

export interface PhaseSummary {
  phase: Phase;
  finished: boolean;
  running: boolean;
  planned: number;
  done: number;
  completion: number;
  hours: number;
  elevation: number;
}

/** Offene Badges, die am nächsten dran sind (höchster Fortschritt zuerst). */
export function nextBadges(badges: Badge[], n: number): Badge[] {
  const ratio = (b: Badge) => (b.progress ? b.progress.current / b.progress.target : b.note?.startsWith("läuft") ? 0.5 : 0);
  return badges.filter((b) => !b.earnedAt).sort((a, b) => ratio(b) - ratio(a)).slice(0, n);
}

export function phaseSummaries(sessions: PlannedSession[], activities: ActivitySummary[], phases: Phase[], today: ISODate): PhaseSummary[] {
  return phases
    .filter((p) => p.kind !== "pause")
    .map((p) => {
      const ses = sessions.filter(
        (s) => s.phase_id === p.id && !s.cancelled && s.date <= today && isWithin(s.date, p.start_date, p.end_date),
      );
      const done = ses.filter((s) => ["done", "shifted"].includes(sessionStatus(s, today))).length;
      const acts = activities.filter((a) => isWithin(a.local_date, p.start_date, p.end_date));
      return {
        phase: p,
        finished: p.end_date < today,
        running: isWithin(today, p.start_date, p.end_date),
        planned: ses.length,
        done,
        completion: ses.length ? done / ses.length : 0,
        hours: acts.reduce((s, a) => s + a.moving_time_s, 0) / 3600,
        elevation: acts.reduce((s, a) => s + a.elevation_gain_m, 0),
      };
    });
}
