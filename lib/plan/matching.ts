// Automatische Zuordnung von Strava-Aktivitäten zu geplanten Einheiten.
import { diffDays, startOfWeek, type ISODate } from "@/lib/dates";
import type { SessionType } from "./types";

export interface MatchSession {
  id: string;
  date: ISODate;
  session_type: SessionType;
  cancelled: boolean;
}

export interface MatchActivity {
  id: number;
  local_date: ISODate;
  start_date_local: string;
  sport_type: string;
  moving_time_s: number;
  zone_seconds: number[] | null;
}

const RUNS = ["Run", "TrailRun", "VirtualRun"];
const RIDES = ["Ride", "MountainBikeRide", "EMountainBikeRide", "GravelRide", "EBikeRide", "VirtualRide"];

/** Mindestzeit in Z4+Z5, damit eine Outdoor-Fahrt als Intervalltraining zählt. */
export const INTERVAL_MIN_HARD_SECONDS = 5 * 60;
/** Maximaler Abstand (Tage) für eine verschobene Einheit – innerhalb derselben Woche. */
export const MAX_SHIFT_DAYS = 2;

const hardSeconds = (a: MatchActivity) => (a.zone_seconds ? (a.zone_seconds[3] ?? 0) + (a.zone_seconds[4] ?? 0) : 0);

/**
 * Passt eine Aktivität zu einem Einheitentyp? Rückgabe: Güte (höher = besser) oder 0.
 * - Kraft: WeightTraining, Workout, Crossfit
 * - Yoga & Mobility: Yoga, Pilates
 * - Enduro: (E-)MountainBikeRide
 * - Gravel: GravelRide, Ride (auch MTB als Ersatz)
 * - Intervalle: VirtualRide (Indoor), Lauf (Laufband/draußen) oder Fahrt mit ≥ 5 min in Z4/Z5
 * - Rennen: jede Radfahrt
 */
export function typeScore(type: SessionType, a: MatchActivity): number {
  const s = a.sport_type;
  switch (type) {
    case "strength":
      return ["WeightTraining", "Workout", "Crossfit"].includes(s) ? 3 : 0;
    case "mobility":
      return ["Yoga", "Pilates"].includes(s) ? 3 : s === "Workout" ? 1 : 0;
    case "enduro":
      return ["MountainBikeRide", "EMountainBikeRide"].includes(s) ? 3 : 0;
    case "gravel":
      return s === "GravelRide" ? 3 : s === "Ride" ? 2 : ["MountainBikeRide", "EBikeRide"].includes(s) ? 1 : 0;
    case "intervals":
      if (s === "VirtualRide") return 3;
      if (RUNS.includes(s)) return 2;
      if (RIDES.includes(s) && hardSeconds(a) >= INTERVAL_MIN_HARD_SECONDS) return 2;
      return 0;
    case "race":
      return RIDES.includes(s) ? 3 : 0;
  }
}

/**
 * Ordnet Aktivitäten den Einheiten zu (jede Aktivität höchstens einmal).
 * 1. Runde: gleicher Tag (beste Typ-Güte, dann längste Aktivität)
 * 2. Runde: ±2 Tage in derselben Woche → Status "verschoben"
 * Abgesagte Einheiten werden nicht zugeordnet.
 */
export function matchActivities(sessions: MatchSession[], activities: MatchActivity[]): Map<string, number> {
  const result = new Map<string, number>();
  const used = new Set<number>();
  const open = sessions.filter((s) => !s.cancelled).sort((a, b) => a.date.localeCompare(b.date));

  const pick = (s: MatchSession, candidates: MatchActivity[]) => {
    let best: MatchActivity | undefined;
    let bestKey: number[] = [];
    for (const a of candidates) {
      if (used.has(a.id)) continue;
      const score = typeScore(s.session_type, a);
      if (!score) continue;
      const key = [-Math.abs(diffDays(s.date, a.local_date)), score, a.moving_time_s];
      if (!best || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) {
        best = a;
        bestKey = key;
      }
    }
    return best;
  };

  // Runde 1: gleicher Tag
  for (const s of open) {
    const a = pick(s, activities.filter((x) => x.local_date === s.date));
    if (a) {
      result.set(s.id, a.id);
      used.add(a.id);
    }
  }
  // Runde 2: verschoben innerhalb der Woche
  for (const s of open) {
    if (result.has(s.id)) continue;
    const week = startOfWeek(s.date);
    const a = pick(
      s,
      activities.filter(
        (x) => startOfWeek(x.local_date) === week && Math.abs(diffDays(s.date, x.local_date)) <= MAX_SHIFT_DAYS,
      ),
    );
    if (a) {
      result.set(s.id, a.id);
      used.add(a.id);
    }
  }
  return result;
}
