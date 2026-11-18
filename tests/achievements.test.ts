import { describe, expect, it } from "vitest";
import { computeBadges, personalRecords, phaseSummaries, streaks, weekResults } from "@/lib/metrics/achievements";
import type { ActivitySummary, Phase, PlannedSession } from "@/lib/plan/types";

const ses = (date: string, type: PlannedSession["session_type"], extra: Partial<PlannedSession> = {}): PlannedSession => ({
  id: `${date}-${type}`, slot_key: `${date}|${type}`, original_date: date, date, start_time: "18:00", session_type: type,
  title: type, target_min: 60, target_max: 60, phase_id: "p1", race_id: null, volume_factor: 1, cancelled: false, note: null,
  activity_id: null, ...extra,
});
const done = (date: string, type: PlannedSession["session_type"], id: number) => ses(date, type, { activity_id: id, activity_date: date });
const act = (id: number, date: string, extra: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id, name: `A${id}`, sport_type: "MountainBikeRide", local_date: date, start_date_local: `${date}T10:00:00`, moving_time_s: 3600,
  distance_m: 20000, elevation_gain_m: 400, avg_hr: 140, max_hr: 170, avg_watts: 150, weighted_avg_watts: 160,
  zone_seconds: null, trimp: 80, ...extra,
});

// Wochen ab 16.11.: W1 erfüllt, W2 erfüllt, W3 verpasst, W4 nichts geplant, W5 erfüllt, W6 laufend
const sessions = [
  done("2026-11-17", "strength", 1), done("2026-11-21", "enduro", 2),
  done("2026-11-24", "strength", 3), ses("2026-11-28", "enduro", { cancelled: true }),
  done("2026-12-01", "strength", 4), ses("2026-12-05", "enduro"),
  done("2026-12-15", "strength", 5),
  done("2026-12-22", "strength", 6), ses("2026-12-26", "enduro"),
];
const today = "2026-12-23";

describe("Serien", () => {
  const weeks = weekResults(sessions, "2026-11-16", today);
  it("bewertet Wochen", () => {
    expect(weeks.map((w) => w.state)).toEqual(["fulfilled", "fulfilled", "partial", "none", "fulfilled", "open"]);
  });
  it("zählt aktuelle und längste Serie; Pausenwochen und laufende Woche unterbrechen nicht", () => {
    const s = streaks(weeks);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
    expect(s.reachedAt(2)).toBe("2026-11-29");
    expect(s.reachedAt(3)).toBeNull();
  });
});

describe("Bestwerte", () => {
  const acts = [
    act(1, "2026-07-01", { moving_time_s: 4 * 3600, distance_m: 60000, elevation_gain_m: 1800 }),
    act(2, "2026-08-01", { sport_type: "VirtualRide", moving_time_s: 3600, weighted_avg_watts: 230 }),
    act(3, "2026-08-02", { sport_type: "VirtualRide", moving_time_s: 600, weighted_avg_watts: 400 }), // zu kurz
    act(4, "2026-08-03", { sport_type: "Hike", moving_time_s: 6 * 3600, elevation_gain_m: 2500, weighted_avg_watts: null, avg_watts: null }),
  ];
  const r = Object.fromEntries(personalRecords(acts, 82).map((x) => [x.key, x]));
  it("findet längste/weiteste Fahrt nur bei Radfahrten", () => {
    expect(r.longest_ride.activityId).toBe(1);
    expect(r.longest_ride.display).toBe("4:00 h");
    expect(r.farthest_ride.display).toBe("60 km");
  });
  it("Höhenmeter über alle Aktivitäten", () => {
    expect(r.most_elevation.activityId).toBe(4);
  });
  it("beste Leistung nur ab 20 min, mit W/kg", () => {
    expect(r.best_power.activityId).toBe(2);
    expect(r.best_power.display).toBe("230 W");
    expect(r.best_power.extra).toBe("2,8 W/kg");
  });
  it("beste Woche", () => {
    expect(r.biggest_week.date).toBe("2026-08-03");
  });
});

describe("Badges", () => {
  const phases: Phase[] = [{ id: "p1", name: "Phase 1 – Einstieg", kind: "training", start_date: "2026-11-16", end_date: "2026-12-20", color: "#000", focus: null }];
  const acts = [act(1, "2026-11-17", { elevation_gain_m: 6000, moving_time_s: 3.5 * 3600 }), act(2, "2026-11-21", { elevation_gain_m: 5000, weighted_avg_watts: 140 })];
  const badges = Object.fromEntries(
    computeBadges({ sessions, activities: acts, phases, races: [], deloads: [], ftp: 136, today, planStart: "2026-11-16" }).map((b) => [b.key, b]),
  );
  it("vergibt Einheiten-Badges mit Datum", () => {
    expect(badges.sessions_1.earnedAt).toBe("2026-11-17");
    expect(badges.sessions_25.earnedAt).toBeNull();
    expect(badges.sessions_25.progress).toEqual({ current: 6, target: 25, unit: "Einheiten" });
  });
  it("vergibt Serien-Badges", () => {
    expect(badges.streak_1.earnedAt).toBe("2026-11-22");
    expect(badges.streak_4.earnedAt).toBeNull();
  });
  it("Höhenmeter kumuliert und am Stück", () => {
    expect(badges.elevation_10000.earnedAt).toBe("2026-11-21");
    expect(badges.day_1000hm.earnedAt).toBe("2026-11-17");
    expect(badges.ride_3h.earnedAt).toBe("2026-11-17");
    expect(badges.ride_4h.earnedAt).toBeNull();
  });
  it("Schwellenfahrt ab FTP", () => {
    expect(badges.power_ftp.earnedAt).toBe("2026-11-17"); // 160 W ≥ 136 W
  });
  it("Phase geschafft ab 80 %", () => {
    // Phase 1 bis 20.12.: 6 Einheiten (ohne Absage), 5 erledigt = 83 %
    expect(badges.phase_p1.earnedAt).toBe("2026-12-20");
  });
});

describe("Phasen", () => {
  it("fasst abgeschlossene Phasen zusammen", () => {
    const phases: Phase[] = [{ id: "p1", name: "Phase 1", kind: "training", start_date: "2026-11-16", end_date: "2026-12-20", color: "#000", focus: null }];
    const [p] = phaseSummaries(sessions, [act(1, "2026-11-17")], phases, today);
    expect(p).toMatchObject({ finished: true, planned: 6, done: 5, hours: 1, elevation: 400 });
  });
});
