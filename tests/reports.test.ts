import { describe, expect, it } from "vitest";
import { buildPhaseReport, buildWeeklyReport, duePhases, dueWeeks, type ReportContext } from "@/lib/reports/build";
import type { ActivitySummary, Phase, PlannedSession } from "@/lib/plan/types";

const ses = (date: string, type: PlannedSession["session_type"], extra: Partial<PlannedSession> = {}): PlannedSession => ({
  id: `${date}-${type}`, slot_key: `${date}|${type}`, original_date: date, date, start_time: "18:00", session_type: type,
  title: { strength: "Kraft", intervals: "Intervalle", mobility: "Yoga", enduro: "Enduro", gravel: "Gravel", cardio: "Ausdauer", race: "Rennen" }[type],
  target_min: 60, target_max: 90, phase_id: "p1", race_id: null, volume_factor: 1, cancelled: false, note: null, activity_id: null, ...extra,
});
const act = (id: number, date: string, extra: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id, name: `A${id}`, sport_type: "MountainBikeRide", local_date: date, start_date_local: `${date}T10:00:00`, moving_time_s: 4500,
  distance_m: 25000, elevation_gain_m: 500, avg_hr: 140, max_hr: 170, avg_watts: 150, weighted_avg_watts: 160,
  zone_seconds: [600, 3300, 300, 240, 60], trimp: 140, ...extra,
});
const linked = (s: PlannedSession, a: ActivitySummary): PlannedSession => ({ ...s, activity_id: a.id, activity: a, activity_date: a.local_date });

const phase: Phase = { id: "p1", name: "Phase 1 – Einstieg", kind: "training", start_date: "2026-11-16", end_date: "2026-12-06", color: "#38bdf8", focus: "Grundlage" };
const next: Phase = { id: "p2", name: "Phase 2 – Kraft", kind: "training", start_date: "2026-12-07", end_date: "2027-01-31", color: "#22c55e", focus: "Kraft" };

// Woche 1 (16.–22.11.): alles erledigt; Woche 2 (23.–29.11.): Kraft + Yoga verpasst, Belastungssprung
const a = [
  act(1, "2026-11-17", { sport_type: "WeightTraining", zone_seconds: null, trimp: 60, distance_m: 0, elevation_gain_m: 0 }),
  act(2, "2026-11-18", { sport_type: "VirtualRide", zone_seconds: [300, 1500, 300, 900, 300], trimp: 150, elevation_gain_m: 0 }),
  act(3, "2026-11-21", { moving_time_s: 3 * 3600, elevation_gain_m: 1100, trimp: 260 }),
  act(4, "2026-11-25", { sport_type: "VirtualRide", zone_seconds: [300, 1500, 1500, 900, 300], trimp: 260 }),
  act(5, "2026-11-28", { moving_time_s: 4 * 3600, elevation_gain_m: 1600, trimp: 420, zone_seconds: [600, 8000, 4000, 1400, 400] }),
];
const sessions = [
  linked(ses("2026-11-17", "strength"), a[0]), linked(ses("2026-11-18", "intervals"), a[1]),
  linked(ses("2026-11-21", "enduro", { target_min: 150, target_max: 240 }), a[2]),
  ses("2026-11-24", "strength"), linked(ses("2026-11-25", "intervals"), a[3]), ses("2026-11-27", "mobility"),
  linked(ses("2026-11-28", "enduro", { target_min: 150, target_max: 240 }), a[4]),
  ses("2026-12-01", "strength"), ses("2026-12-03", "strength"),
];
const ctx: ReportContext = {
  sessions, activities: a, phases: [phase, next], deloads: [], races: [], ftp: 136, weightKg: 82, today: "2026-12-08",
};

describe("Wochenreview", () => {
  const w1 = buildWeeklyReport(ctx, "2026-11-16");
  const w2 = buildWeeklyReport(ctx, "2026-11-23");

  it("enthält Soll/Ist, Phase und Einheiten", () => {
    expect(w1).toMatchObject({ kw: 47, phase: { name: "Phase 1 – Einstieg", week: 1, total: 3 } });
    expect(w1.stats).toMatchObject({ planned: 3, done: 3 });
    expect(w1.sessions.map((s) => s.status)).toEqual(["done", "done", "done"]);
    expect(w2.stats).toMatchObject({ planned: 4, done: 2, missed: 2 });
  });
  it("Was war gut: Plan erfüllt, Intensität, Höhenmeter, Badges", () => {
    expect(w1.highlights).toContain("Plan zu 100 % erfüllt – alle 3 Einheiten erledigt.");
    expect(w1.highlights).toContain("Intensität gesetzt: 25 min in Z4–Z5.");
    expect(w1.highlights.some((h) => h.startsWith("Badges verdient: 🚀 Los geht's, ✅ Volle Woche"))).toBe(true);
    // erste Woche mit Daten: keine "Bestwerte"-Flut
    expect(w1.records).toEqual([]);
    // Woche 2: längere Fahrt → Bestwert, max. 3 genannt
    expect(w2.highlights.some((h) => h.startsWith("Neuer Bestwert: Längste Fahrt – 4:00 h"))).toBe(true);
    expect(w2.highlights.filter((h) => h.startsWith("Neuer Bestwert")).length).toBeLessThanOrEqual(3);
  });
  it("Wo steckt Potenzial: verpasste Einheiten, Kraft, Mobility, Belastungssprung, graue Zone", () => {
    expect(w2.potentials[0]).toBe("2 Einheiten verpasst (Kraft, Yoga & Mobility).");
    expect(w2.potentials.some((p) => p.startsWith("Krafttraining ausgelassen"))).toBe(true);
    expect(w2.potentials.some((p) => p.startsWith("Yoga & Mobility ausgelassen"))).toBe(true);
    expect(w2.potentials.some((p) => p.startsWith("Belastung +45 % zur Vorwoche"))).toBe(true);
    expect(w2.potentials.some((p) => p.includes("in Z3 („graue Zone“)"))).toBe(true);
  });
  it("vergleicht mit der Vorwoche", () => {
    expect(w2.previous.trimp).toBe(470);
    expect(w2.stats.trimp).toBe(680);
  });
  it("erkennt wiederkehrende Ausfälle am gleichen Wochentag", () => {
    const w3 = buildWeeklyReport(ctx, "2026-11-30");
    expect(w3.potentials.some((p) => p.startsWith("Am Dienstag fällt in den letzten 4 Wochen öfter etwas aus (2×)"))).toBe(true);
  });
  it("Ruhewoche ohne Plan ist kein Problem", () => {
    const quiet = buildWeeklyReport({ ...ctx, phases: [{ ...phase, kind: "pause", start_date: "2026-12-14", end_date: "2026-12-27" }] }, "2026-12-14");
    expect(quiet.highlights).toEqual(["Ruhewoche – Erholung ist Teil des Trainings."]);
    expect(quiet.potentials).toEqual(["Keine Auffälligkeiten – genau so weitermachen."]);
  });
});

describe("Phasenbericht", () => {
  const r = buildPhaseReport(ctx, "p1");
  it("summiert die Phase", () => {
    expect(r.weeks).toHaveLength(3);
    expect(r.totals).toMatchObject({ planned: 9, done: 5, missed: 4 });
    expect(r.fulfilledWeeks).toBe(1);
    expect(r.missedByType).toEqual({ strength: 3, mobility: 1 });
    expect(r.next).toEqual({ name: "Phase 2 – Kraft", start_date: "2026-12-07", focus: "Kraft" });
  });
  it("bewertet die Phase", () => {
    expect(r.potentials).toContain("Nur 56 % der Einheiten erledigt (5/9) – Ursachen für Ausfälle anschauen.");
    expect(r.potentials).toContain("Am häufigsten verpasst: Kraft (3×).");
  });
});

describe("Fälligkeit", () => {
  it("nur abgeschlossene Wochen ab Planstart", () => {
    expect(dueWeeks("2026-11-16", "2026-11-23")).toEqual(["2026-11-16"]);
    expect(dueWeeks("2026-11-16", "2026-11-22")).toEqual([]);
  });
  it("nur abgeschlossene Phasen ohne Pause", () => {
    const pause: Phase = { ...phase, id: "x", kind: "pause", end_date: "2026-11-30" };
    expect(duePhases([phase, pause, next], "2026-12-07").map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("Wochenreview mit ersetzten Einheiten", () => {
  it("zeigt die ursprüngliche Art und lobt Flexibilität", () => {
    const yoga = act(9, "2026-11-22", { sport_type: "Yoga", zone_seconds: null, trimp: 10, distance_m: 0, elevation_gain_m: 0 });
    const gravelToYoga = linked(ses("2026-11-22", "mobility", { slot_key: "2026-11-22|gravel", title: "Yoga statt Gravel" }), yoga);
    const r = buildWeeklyReport({ ...ctx, sessions: [...sessions, gravelToYoga], activities: [...a, yoga] }, "2026-11-16");
    const s = r.sessions.find((x) => x.title === "Yoga statt Gravel")!;
    expect(s).toMatchObject({ status: "done", replaced_type: "gravel" });
    expect(r.highlights).toContain("Flexibel geblieben: eine Einheit ersetzt statt ausgelassen (Gravel → Yoga & Mobility).");
    expect(r.sessions.filter((x) => x.title !== "Yoga statt Gravel").every((x) => !x.replaced_type)).toBe(true);
  });
});
