import { describe, expect, it } from "vitest";
import { generatePlan, phaseForDate, phaseWeek } from "@/lib/plan/generate";
import { SEED_DELOADS, SEED_OVERRIDES, SEED_PHASES, SEED_RACES, SEED_TEMPLATE } from "@/lib/plan/seed-data";
import { sessionStatus } from "@/lib/plan/status";
import { isoWeekday } from "@/lib/dates";

const plan = generatePlan({
  phases: SEED_PHASES,
  races: SEED_RACES,
  deloads: SEED_DELOADS,
  template: SEED_TEMPLATE,
  overrides: SEED_OVERRIDES,
});
const byKey = new Map(plan.map((s) => [s.slot_key, s]));
const on = (d: string) => plan.filter((s) => s.date === d);

describe("Plan-Generator", () => {
  it("startet am Montag 16.11.26 mit Ruhetag, erste Einheit Di 17.11. Kraft A", () => {
    expect(isoWeekday("2026-11-16")).toBe(1);
    expect(on("2026-11-16")).toHaveLength(0);
    const s = on("2026-11-17");
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ title: "Kraft A", start_time: "18:00", target_min: 45, target_max: 60 });
  });

  it("legt die Standardwoche korrekt an", () => {
    const week = plan.filter((s) => s.original_date >= "2026-11-30" && s.original_date <= "2026-12-06");
    expect(week.map((s) => [isoWeekday(s.date), s.title, s.start_time])).toEqual([
      [2, "Kraft A", "18:00"],
      [3, "Intervalle", "18:00"],
      [4, "Kraft B", "18:00"],
      [5, "Yoga & Mobility", "18:00"],
      [6, "Enduro", "10:00"],
      [7, "Gravel Zone 2", "10:00"],
    ]);
  });

  it("Phase 1 hat 30 Einheiten, davon Gravel am 22.11. abgesagt", () => {
    const p1 = plan.filter((s) => s.phase_id === SEED_PHASES[0].id);
    expect(p1).toHaveLength(30);
    expect(byKey.get("2026-11-22|gravel")?.cancelled).toBe(true);
    expect(p1.filter((s) => s.cancelled)).toHaveLength(1);
  });

  it("plant in der Pause (21.12.–3.1.) nichts", () => {
    expect(plan.filter((s) => s.date >= "2026-12-21" && s.date <= "2027-01-03")).toHaveLength(0);
  });

  it("reduziert Entlastungswochen auf 60 % (auf 5 min gerundet)", () => {
    const kraft = byKey.get("2027-01-26|strength")!;
    expect(kraft.volume_factor).toBe(0.6);
    expect([kraft.target_min, kraft.target_max]).toEqual([25, 35]);
    const enduro = byKey.get("2027-01-30|enduro")!;
    expect([enduro.target_min, enduro.target_max]).toEqual([90, 145]);
    expect(enduro.title).toContain("Entlastung");
    // Woche davor normal
    expect(byKey.get("2027-01-23|enduro")!.volume_factor).toBe(1);
  });

  it("alle sechs Entlastungswochen wirken", () => {
    for (const d of SEED_DELOADS) {
      const inWeek = plan.filter((s) => s.original_date >= d.start_date && s.original_date <= d.end_date);
      expect(inWeek.length).toBeGreaterThan(0);
      expect(inWeek.every((s) => s.volume_factor === 0.6)).toBe(true);
    }
  });

  it("verschiebt Enduro vom Sa 5.6.27 auf So 6.6.27 und streicht Gravel", () => {
    expect(on("2027-06-05")).toHaveLength(0);
    const sunday = on("2027-06-06");
    expect(sunday.map((s) => [s.session_type, s.cancelled])).toEqual(
      expect.arrayContaining([["enduro", false], ["gravel", true]]),
    );
    expect(byKey.get("2027-06-05|enduro")?.date).toBe("2027-06-06");
  });

  it("Tapering: 50 % Umfang, keine Kraft in den letzten 7 Tagen", () => {
    const taper = plan.filter((s) => s.date >= "2027-06-14" && s.date <= "2027-06-24");
    expect(taper.every((s) => s.volume_factor === 0.5)).toBe(true);
    const strength = taper.filter((s) => s.session_type === "strength").map((s) => s.date);
    expect(strength).toEqual(["2027-06-15", "2027-06-17"]);
    expect(byKey.get("2027-06-16|intervals")?.title).toBe("Intervalle kurz (Tapering)");
  });

  it("Renntage: nur Renn-Einheiten", () => {
    for (const d of ["2027-06-25", "2027-06-26", "2027-06-27", "2027-06-28"]) {
      const s = on(d);
      expect(s).toHaveLength(1);
      expect(s[0].session_type).toBe("race");
    }
    expect(on("2027-06-25")[0].title).toBe("Enduro One Schulenberg – Tag 1");
    expect(on("2027-09-04")[0].session_type).toBe("race");
    expect(on("2027-09-05")[0].session_type).toBe("race");
  });

  it("Erholung: nur Yoga und lockeres Gravel", () => {
    const rec = plan.filter((s) => s.date >= "2027-06-29" && s.date <= "2027-07-04");
    expect(rec.map((s) => s.title)).toEqual(["Yoga & Mobility", "Gravel locker (Erholung)"]);
  });

  it("hat eindeutige Slot-Keys und keine Einheiten nach dem letzten Rennen", () => {
    expect(new Set(plan.map((s) => s.slot_key)).size).toBe(plan.length);
    expect(plan.every((s) => s.date <= "2027-09-05")).toBe(true);
  });
});

describe("Phasen-Helfer", () => {
  it("findet Phase und Woche", () => {
    const p = phaseForDate(SEED_PHASES, "2026-11-25")!;
    expect(p.name).toBe("Phase 1 – Einstieg");
    expect(phaseWeek(p, "2026-11-25")).toEqual({ week: 2, total: 5 });
  });
});

describe("Status", () => {
  const base = { date: "2026-11-17", original_date: "2026-11-17", cancelled: false, activity_id: null };
  it("berechnet Status", () => {
    expect(sessionStatus(base, "2026-11-16")).toBe("planned");
    expect(sessionStatus(base, "2026-11-17")).toBe("planned");
    expect(sessionStatus(base, "2026-11-18")).toBe("missed");
    expect(sessionStatus({ ...base, cancelled: true }, "2026-11-18")).toBe("cancelled");
    expect(sessionStatus({ ...base, activity_id: 1, activity_date: "2026-11-17" }, "2026-11-18")).toBe("done");
    expect(sessionStatus({ ...base, activity_id: 1, activity_date: "2026-11-18" }, "2026-11-18")).toBe("shifted");
  });
});
