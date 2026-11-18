// Wochenkennzahlen für Dashboard (und später Berichte) – reine Funktionen.
import { addDays, isWithin, startOfWeek, type ISODate } from "@/lib/dates";
import { sessionStatus } from "@/lib/plan/status";
import type { ActivitySummary, PlannedSession } from "@/lib/plan/types";

export interface WeekStats {
  weekStart: ISODate;
  weekEnd: ISODate;
  /** geplante Einheiten ohne Absagen (Renntage zählen mit) */
  planned: number;
  /** erledigt (am Plantag oder verschoben) */
  done: number;
  missed: number;
  cancelled: number;
  /** Soll-Spanne in Stunden (Summe der Zieldauern, ohne Rennen) */
  plannedMinH: number;
  plannedMaxH: number;
  /** Ist: alle Aktivitäten der Woche */
  hours: number;
  elevation: number;
  distanceKm: number;
  trimp: number;
  zoneSeconds: [number, number, number, number, number];
  activities: number;
}

export function weekStats(
  weekStart: ISODate,
  sessions: PlannedSession[],
  activities: ActivitySummary[],
  today: ISODate,
): WeekStats {
  const weekEnd = addDays(weekStart, 6);
  const ses = sessions.filter((s) => isWithin(s.date, weekStart, weekEnd));
  const acts = activities.filter((a) => isWithin(a.local_date, weekStart, weekEnd));
  const statuses = ses.map((s) => sessionStatus(s, today));
  const active = ses.filter((s) => !s.cancelled);
  const zones: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const a of acts) a.zone_seconds?.forEach((z, i) => (zones[i] += z ?? 0));
  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  return {
    weekStart,
    weekEnd,
    planned: active.length,
    done: statuses.filter((s) => s === "done" || s === "shifted").length,
    missed: statuses.filter((s) => s === "missed").length,
    cancelled: statuses.filter((s) => s === "cancelled").length,
    plannedMinH: sum(active.map((s) => s.target_min ?? 0)) / 60,
    plannedMaxH: sum(active.map((s) => s.target_max ?? 0)) / 60,
    hours: sum(acts.map((a) => a.moving_time_s)) / 3600,
    elevation: sum(acts.map((a) => a.elevation_gain_m)),
    distanceKm: sum(acts.map((a) => a.distance_m)) / 1000,
    trimp: sum(acts.map((a) => a.trimp ?? 0)),
    zoneSeconds: zones,
    activities: acts.length,
  };
}

/** Kennzahlen für die letzten n Wochen bis einschließlich der Woche von `today` (älteste zuerst). */
export function lastWeeks(n: number, sessions: PlannedSession[], activities: ActivitySummary[], today: ISODate): WeekStats[] {
  const current = startOfWeek(today);
  return Array.from({ length: n }, (_, i) => weekStats(addDays(current, -7 * (n - 1 - i)), sessions, activities, today));
}

/**
 * Vorwoche bis zum gleichen Wochentag – fairer Vergleich für die laufende Woche
 * (Mittwoch mit Mittwoch statt halbe gegen ganze Woche).
 */
export function previousWeekToDate(sessions: PlannedSession[], activities: ActivitySummary[], today: ISODate): WeekStats {
  const cutoff = addDays(today, -7);
  return weekStats(
    addDays(startOfWeek(today), -7),
    sessions.filter((s) => s.date <= cutoff),
    activities.filter((a) => a.local_date <= cutoff),
    today,
  );
}

/** Anteile locker (Z1–Z2) / mittel (Z3) / hart (Z4–Z5) in Prozent; null ohne HF-Daten. */
export function intensitySplit(z: number[]): { easy: number; moderate: number; hard: number } | null {
  const total = z.reduce((s, x) => s + x, 0);
  if (!total) return null;
  const pct = (x: number) => Math.round((x / total) * 100);
  return { easy: pct(z[0] + z[1]), moderate: pct(z[2]), hard: pct(z[3] + z[4]) };
}

/** Veränderung in Prozent gegenüber dem Vergleichswert; null, wenn nicht sinnvoll. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}
