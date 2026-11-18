import { describe, expect, it } from "vitest";
import { buildHrHistogram, mapActivity, trimpFromZones, zoneSecondsFromHistogram } from "@/lib/strava/mapping";
import { matchActivities, typeScore, type MatchActivity, type MatchSession } from "@/lib/plan/matching";
import { importAfterEpoch, parseRateLimit } from "@/lib/strava/limits";

const ZONES = { hr_z2: 127, hr_z3: 158, hr_z4: 174, hr_z5: 189 };

describe("mapActivity", () => {
  const raw = {
    id: 12345678901,
    name: "Feierabendrunde",
    sport_type: "MountainBikeRide",
    type: "Ride",
    start_date: "2026-11-21T09:05:00Z",
    start_date_local: "2026-11-21T10:05:00Z",
    moving_time: 9000,
    elapsed_time: 9800,
    distance: 42123.45,
    total_elevation_gain: 1034.56,
    average_heartrate: 141.27,
    max_heartrate: 182,
    average_watts: 160.4,
    device_watts: false,
    has_heartrate: true,
    map: { summary_polyline: "abc" },
  };
  const row = mapActivity(raw, new Date("2026-11-21T12:00:00Z"));

  it("übernimmt Kennzahlen und lokales Datum", () => {
    expect(row).toMatchObject({
      id: 12345678901,
      sport_type: "MountainBikeRide",
      local_date: "2026-11-21",
      start_date_local: "2026-11-21T10:05:00",
      moving_time_s: 9000,
      distance_m: 42123.5,
      elevation_gain_m: 1034.6,
      avg_hr: 141.3,
      max_hr: 182,
      avg_watts: 160.4,
      weighted_avg_watts: null,
      has_heartrate: true,
    });
  });
  it("speichert die Karte nicht", () => {
    expect(row.raw).not.toHaveProperty("map");
    expect(row.raw).toHaveProperty("name", "Feierabendrunde");
  });
  it("nimmt das lokale Datum, nicht UTC", () => {
    const late = mapActivity({ ...raw, start_date: "2026-11-21T23:30:00Z", start_date_local: "2026-11-22T00:30:00Z" });
    expect(late.local_date).toBe("2026-11-22");
  });
});

describe("HF-Histogramm und Zonen", () => {
  it("summiert Sekunden pro bpm und ignoriert Pausen", () => {
    const time = [0, 1, 2, 3, 100, 101];
    const hr = [120, 120, 160, 160, 190, 190];
    expect(buildHrHistogram(time, hr)).toEqual({ "120": 2, "160": 1, "190": 1 });
  });
  it("teilt in Zonen gemäß Einstellungen (Grenzen inklusive)", () => {
    const hist = { "126": 60, "127": 60, "157": 60, "158": 60, "173": 60, "174": 60, "188": 60, "189": 60, "200": 60 };
    expect(zoneSecondsFromHistogram(hist, ZONES)).toEqual([60, 120, 120, 120, 120]);
  });
  it("berechnet Edwards-TRIMP", () => {
    expect(trimpFromZones([600, 3600, 600, 300, 60])).toBe(10 + 120 + 30 + 20 + 5);
  });
});

describe("Rate-Limit und Importbeginn", () => {
  it("liest die Strava-Header (Lese-Limit bevorzugt)", () => {
    const h = new Headers({
      "x-ratelimit-limit": "200,2000",
      "x-ratelimit-usage": "10,50",
      "x-readratelimit-limit": "100,1000",
      "x-readratelimit-usage": "95,400",
    });
    expect(parseRateLimit(h)).toEqual({ limit15: 100, usage15: 95, limitDay: 1000, usageDay: 400 });
    expect(parseRateLimit(new Headers())).toBeNull();
  });
  it("startet den Import am 01.06.2026 00:00 Berliner Zeit", () => {
    expect(new Date(importAfterEpoch() * 1000).toISOString()).toBe("2026-05-31T22:00:00.000Z");
  });
});

describe("Zuordnung Aktivität ↔ Einheit", () => {
  const act = (id: number, date: string, sport: string, extra: Partial<MatchActivity> = {}): MatchActivity => ({
    id, local_date: date, start_date_local: `${date}T10:00:00`, sport_type: sport, moving_time_s: 3600, zone_seconds: null, ...extra,
  });
  const ses = (id: string, date: string, type: MatchSession["session_type"], cancelled = false): MatchSession => ({
    id, date, session_type: type, cancelled,
  });
  // Woche 16.–22.11.2026
  const week = [
    ses("kraftA", "2026-11-17", "strength"),
    ses("iv", "2026-11-18", "intervals"),
    ses("kraftB", "2026-11-19", "strength"),
    ses("yoga", "2026-11-20", "mobility"),
    ses("enduro", "2026-11-21", "enduro"),
    ses("gravel", "2026-11-22", "gravel", true),
  ];

  it("ordnet am selben Tag passende Typen zu", () => {
    const m = matchActivities(week, [
      act(1, "2026-11-17", "WeightTraining"),
      act(2, "2026-11-18", "VirtualRide"),
      act(3, "2026-11-21", "MountainBikeRide"),
      act(4, "2026-11-20", "Yoga"),
    ]);
    expect(Object.fromEntries(m)).toEqual({ kraftA: 1, iv: 2, enduro: 3, yoga: 4 });
  });

  it("erkennt verschobene Einheiten (±2 Tage, gleiche Woche)", () => {
    const m = matchActivities(week, [act(1, "2026-11-18", "WeightTraining"), act(2, "2026-11-22", "MountainBikeRide")]);
    expect(m.get("kraftA")).toBe(1); // Kraft A Di → Mi gemacht
    expect(m.get("kraftB")).toBeUndefined(); // Aktivität nur einmal vergeben
    expect(m.get("enduro")).toBe(2); // Sa → So
  });

  it("ordnet nicht über die Wochengrenze und nicht weiter als 2 Tage zu", () => {
    const m = matchActivities(week, [act(1, "2026-11-23", "MountainBikeRide"), act(2, "2026-11-20", "WeightTraining")]);
    expect(m.get("enduro")).toBeUndefined();
    expect(m.get("kraftA")).toBeUndefined(); // 3 Tage Abstand
    expect(m.get("kraftB")).toBe(2);
  });

  it("ignoriert abgesagte Einheiten", () => {
    const m = matchActivities(week, [act(1, "2026-11-22", "GravelRide")]);
    expect(m.size).toBe(0);
  });

  it("Intervalle: Indoor immer, outdoor nur mit Z4/Z5-Anteil", () => {
    expect(typeScore("intervals", act(1, "x", "VirtualRide"))).toBeGreaterThan(0);
    expect(typeScore("intervals", act(1, "x", "Ride", { zone_seconds: [0, 3000, 300, 100, 50] }))).toBe(0);
    expect(typeScore("intervals", act(1, "x", "Ride", { zone_seconds: [0, 2000, 600, 400, 200] }))).toBeGreaterThan(0);
  });

  it("Intervalle: Läufe (Laufband oder draußen) zählen", () => {
    expect(typeScore("intervals", act(1, "x", "Run"))).toBeGreaterThan(0);
    expect(typeScore("intervals", act(1, "x", "VirtualRun"))).toBeGreaterThan(0);
    expect(typeScore("gravel", act(1, "x", "Run"))).toBe(0);
  });

  it("Ausdauer (Studio/Lauf): Laufband, Crosstrainer, Rudern", () => {
    for (const t of ["Run", "VirtualRun", "Elliptical", "Rowing", "StairStepper"]) expect(typeScore("cardio", act(1, "x", t))).toBe(3);
    expect(typeScore("cardio", act(1, "x", "VirtualRide"))).toBe(2);
    expect(typeScore("cardio", act(1, "x", "MountainBikeRide"))).toBe(0);
  });

  it("bevorzugt bei mehreren Kandidaten den passenderen Typ und dann die längere Aktivität", () => {
    const sunday = [ses("g", "2026-11-29", "gravel")];
    const m = matchActivities(sunday, [
      act(1, "2026-11-29", "MountainBikeRide", { moving_time_s: 9000 }),
      act(2, "2026-11-29", "GravelRide", { moving_time_s: 5000 }),
    ]);
    expect(m.get("g")).toBe(2);
  });
});
