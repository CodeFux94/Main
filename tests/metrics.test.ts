import { describe, expect, it } from "vitest";
import { deltaPct, intensitySplit, lastWeeks, previousWeekToDate, weekStats } from "@/lib/metrics/weekly";
import type { ActivitySummary, PlannedSession } from "@/lib/plan/types";

const ses = (date: string, type: PlannedSession["session_type"], extra: Partial<PlannedSession> = {}): PlannedSession => ({
  id: `${date}-${type}`, slot_key: `${date}|${type}`, original_date: date, date, start_time: "18:00", session_type: type,
  title: type, target_min: 60, target_max: 90, phase_id: null, race_id: null, volume_factor: 1, cancelled: false, note: null,
  activity_id: null, ...extra,
});
const act = (id: number, date: string, extra: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id, name: "x", sport_type: "Ride", local_date: date, start_date_local: `${date}T10:00:00`, moving_time_s: 3600,
  distance_m: 30000, elevation_gain_m: 500, avg_hr: 140, max_hr: 170, avg_watts: null, weighted_avg_watts: null,
  zone_seconds: [600, 2400, 300, 300, 0], trimp: 100, ...extra,
});

describe("Wochenkennzahlen", () => {
  const sessions = [
    ses("2026-11-17", "strength", { activity_id: 1, activity_date: "2026-11-17" }),
    ses("2026-11-18", "intervals", { activity_id: 2, activity_date: "2026-11-19" }), // verschoben
    ses("2026-11-19", "strength"), // verpasst (heute = 20.)
    ses("2026-11-21", "enduro", { target_min: 150, target_max: 240 }),
    ses("2026-11-22", "gravel", { cancelled: true }),
    ses("2026-11-24", "strength"), // Folgewoche
  ];
  const acts = [act(1, "2026-11-17"), act(2, "2026-11-19", { trimp: 150, elevation_gain_m: 1000 }), act(3, "2026-11-23")];
  const w = weekStats("2026-11-16", sessions, acts, "2026-11-20");

  it("zählt Soll/Ist der Einheiten", () => {
    expect(w).toMatchObject({ planned: 4, done: 2, missed: 1, cancelled: 1, activities: 2 });
  });
  it("summiert Stunden, Höhenmeter, Distanz und Belastung", () => {
    expect(w.hours).toBe(2);
    expect(w.elevation).toBe(1500);
    expect(w.distanceKm).toBe(60);
    expect(w.trimp).toBe(250);
    expect(w.zoneSeconds).toEqual([1200, 4800, 600, 600, 0]);
  });
  it("berechnet die Soll-Spanne ohne Absagen", () => {
    expect(w.plannedMinH).toBeCloseTo((60 + 60 + 60 + 150) / 60);
    expect(w.plannedMaxH).toBeCloseTo((90 + 90 + 90 + 240) / 60);
  });
  it("liefert 6 Wochen, älteste zuerst, bis zur aktuellen", () => {
    const weeks = lastWeeks(6, sessions, acts, "2026-11-25");
    expect(weeks.map((x) => x.weekStart)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(weeks[5].activities).toBe(1);
  });
  it("teilt die Intensität auf", () => {
    expect(intensitySplit([1200, 4800, 600, 600, 0])).toEqual({ easy: 83, moderate: 8, hard: 8 });
    expect(intensitySplit([0, 0, 0, 0, 0])).toBeNull();
  });
  it("vergleicht mit der Vorwoche bis zum gleichen Wochentag", () => {
    // heute Mi 25.11. → Vorwoche bis Mi 18.11.: nur Aktivität 1 (17.11.), nicht 2 (19.11.)
    const p = previousWeekToDate(sessions, acts, "2026-11-25");
    expect(p.weekStart).toBe("2026-11-16");
    expect(p.activities).toBe(1);
    expect(p.hours).toBe(1);
  });
  it("berechnet Veränderungen", () => {
    expect(deltaPct(110, 100)).toBe(10);
    expect(deltaPct(5, 0)).toBeNull();
  });
});
