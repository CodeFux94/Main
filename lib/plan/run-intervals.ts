// Winterregel: Mittwochs-Intervalle als Laufeinheit (Laufband im Studio oder draußen),
// solange es abends zu dunkel und kalt fürs Rad ist. Ab der Zeitumstellung wieder Gravel.
import { isWithin, type ISODate } from "@/lib/dates";

/** Letzter Tag mit Laufintervallen (Zeitumstellung 28.3.2027). Danach Rad laut Plan. */
export const RUN_INTERVALS_UNTIL: ISODate = "2027-03-28";

interface RunBlock {
  from: ISODate;
  to: ISODate;
  main: string;
  min: number;
  max: number;
}

/** Hauptteil je Zeitraum, passend zu den Phasen. */
export const RUN_BLOCKS: RunBlock[] = [
  { from: "2026-11-16", to: "2026-12-20", main: "6–8× 1–2 min zügig (Z3–Z4), je 1–2 min gehen oder traben. Behutsam starten", min: 40, max: 50 },
  { from: "2027-01-04", to: "2027-01-31", main: "Schwelle 3× 8–10 min Z4 (Laufband 3–5 % Steigung), je 3 min traben", min: 50, max: 60 },
  { from: "2027-02-01", to: "2027-02-28", main: "Schwelle 3× 10–12 min Z4 (Laufband 3–5 % Steigung), je 3 min traben", min: 55, max: 65 },
  { from: "2027-03-01", to: "2027-03-28", main: "5× 3 min sehr hart (Z4–Z5, Laufband 6–8 % Steigung), je 3 min locker", min: 45, max: 50 },
];

export interface RunWorkout {
  title: string;
  note: string;
  min: number;
  max: number;
}

/** Laufeinheit für einen Intervall-Tag – oder null, wenn dort Rad-Intervalle gelten. */
export function runIntervalWorkout(d: ISODate, deload: boolean): RunWorkout | null {
  if (d > RUN_INTERVALS_UNTIL) return null;
  const block = RUN_BLOCKS.find((b) => isWithin(d, b.from, b.to));
  if (!block) return null;
  const parts = [
    "10 min einlaufen",
    block.main,
    "5–10 min auslaufen",
    "Laufband bevorzugt, draußen nur beleuchtet (Stirnlampe, Reflexkleidung)",
  ];
  if (deload) parts.push("Entlastung: Anzahl der Intervalle halbieren");
  return {
    title: deload ? "Laufintervalle (Entlastung)" : "Laufintervalle",
    note: parts.join(" · "),
    min: block.min,
    max: block.max,
  };
}
