// Ausgangsplan "Enduro One 2027".
// Quelle für supabase/seed.sql (erzeugt via `npm run seed:sql`) und für die Tests.
import type { DeloadWeek, Phase, PlanOverride, Race, TemplateSession } from "./types";

export const SEED_RACES: Race[] = [
  { id: "a0000000-0000-4000-8000-000000000001", name: "Enduro One Schulenberg", location: "Schulenberg (Harz)", start_date: "2027-06-25", end_date: "2027-06-28" },
  { id: "a0000000-0000-4000-8000-000000000002", name: "Enduro One Roßbach", location: "Roßbach", start_date: "2027-09-04", end_date: "2027-09-05" },
];

const P = (n: number) => `b0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

export const SEED_PHASES: Phase[] = [
  { id: P(1), name: "Phase 1 – Einstieg", kind: "training", start_date: "2026-11-16", end_date: "2026-12-20", color: "#38bdf8", focus: "Gewöhnung, Technik, Grundlage" },
  { id: P(2), name: "Pause", kind: "pause", start_date: "2026-12-21", end_date: "2027-01-03", color: "#64748b", focus: "Feiertage, Erholung" },
  { id: P(3), name: "Phase 2 – Kraft + Grundlage", kind: "training", start_date: "2027-01-04", end_date: "2027-02-28", color: "#22c55e", focus: "Maximalkraft, Zone-2-Umfang" },
  { id: P(4), name: "Phase 3 – Power + Intensität", kind: "training", start_date: "2027-03-01", end_date: "2027-05-02", color: "#f59e0b", focus: "Schwelle, VO2max, Explosivität" },
  { id: P(5), name: "Phase 4 – Rennspezifisch", kind: "training", start_date: "2027-05-03", end_date: "2027-06-13", color: "#ef4444", focus: "Renntempo, Abfahrten, Wiederholungen" },
  { id: P(6), name: "Tapering Schulenberg", kind: "taper", start_date: "2027-06-14", end_date: "2027-06-24", color: "#a855f7", focus: "Frische aufbauen" },
  { id: P(7), name: "Rennen Schulenberg", kind: "race", start_date: "2027-06-25", end_date: "2027-06-28", color: "#eab308", focus: "Enduro One Schulenberg" },
  { id: P(8), name: "Erholung", kind: "recovery", start_date: "2027-06-29", end_date: "2027-07-04", color: "#64748b", focus: "Regeneration" },
  { id: P(9), name: "Phase 5 – Wiederaufbau", kind: "training", start_date: "2027-07-05", end_date: "2027-08-01", color: "#22c55e", focus: "Grundlage und Kraft auffrischen" },
  { id: P(10), name: "Phase 6 – Rennspezifisch", kind: "training", start_date: "2027-08-02", end_date: "2027-08-22", color: "#ef4444", focus: "Renntempo" },
  { id: P(11), name: "Tapering Roßbach", kind: "taper", start_date: "2027-08-23", end_date: "2027-09-03", color: "#a855f7", focus: "Frische aufbauen" },
  { id: P(12), name: "Rennen Roßbach", kind: "race", start_date: "2027-09-04", end_date: "2027-09-05", color: "#eab308", focus: "Enduro One Roßbach" },
];

const D = (n: number) => `c0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

export const SEED_DELOADS: DeloadWeek[] = [
  { id: D(1), start_date: "2027-01-25", end_date: "2027-01-31", volume_factor: 0.6 },
  { id: D(2), start_date: "2027-02-22", end_date: "2027-02-28", volume_factor: 0.6 },
  { id: D(3), start_date: "2027-03-22", end_date: "2027-03-28", volume_factor: 0.6 },
  { id: D(4), start_date: "2027-04-26", end_date: "2027-05-02", volume_factor: 0.6 },
  { id: D(5), start_date: "2027-05-24", end_date: "2027-05-30", volume_factor: 0.6 },
  { id: D(6), start_date: "2027-07-26", end_date: "2027-08-01", volume_factor: 0.6 },
];

const T = (n: number) => `d0000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

// Montag = Ruhetag (kein Eintrag)
export const SEED_TEMPLATE: TemplateSession[] = [
  { id: T(1), weekday: 2, session_type: "strength", title: "Kraft A", start_time: "18:00", duration_min: 45, duration_max: 60 },
  { id: T(2), weekday: 3, session_type: "intervals", title: "Intervalle", start_time: "18:00", duration_min: 60, duration_max: 75 },
  { id: T(3), weekday: 4, session_type: "strength", title: "Kraft B", start_time: "18:00", duration_min: 60, duration_max: 60 },
  { id: T(4), weekday: 5, session_type: "mobility", title: "Yoga & Mobility", start_time: "18:00", duration_min: 20, duration_max: 30 },
  { id: T(5), weekday: 6, session_type: "enduro", title: "Enduro", start_time: "10:00", duration_min: 150, duration_max: 240 },
  { id: T(6), weekday: 7, session_type: "gravel", title: "Gravel Zone 2", start_time: "10:00", duration_min: 90, duration_max: 150 },
];

export const SEED_OVERRIDES: PlanOverride[] = [
  { slot_key: "2026-11-22|gravel", action: "cancel", new_date: null, new_time: null, note: "Gravel entfällt" },
  { slot_key: "2027-06-05|enduro", action: "move", new_date: "2027-06-06", new_time: "10:00", note: "Enduro auf Sonntag verschoben" },
  { slot_key: "2027-06-06|gravel", action: "cancel", new_date: null, new_time: null, note: "Entfällt wegen Enduro am Sonntag" },
];

export const SEED_SETTINGS = {
  ftp_w: 136,
  weight_kg: 82,
  // Untergrenzen in bpm; Z1 = alles unter Z2
  hr_z2: 127,
  hr_z3: 158,
  hr_z4: 174,
  hr_z5: 189,
};
