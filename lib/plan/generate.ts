import { diffDays, eachDay, isWithin, isoWeekday, type ISODate } from "@/lib/dates";
import type { DeloadWeek, Phase, PlanOverride, PlannedSlot, Race, TemplateSession } from "./types";

export interface PlanInput {
  phases: Phase[];
  races: Race[];
  deloads: DeloadWeek[];
  template: TemplateSession[];
  overrides: PlanOverride[];
}

/** Umfang im Tapering (Anteil der Standarddauer). */
export const TAPER_FACTOR = 0.5;
/** Umfang der lockeren Ausfahrt in der Erholungsphase. */
export const RECOVERY_FACTOR = 0.5;
/** Kein Krafttraining mehr in den letzten N Tagen vor dem Rennen. */
export const TAPER_NO_STRENGTH_DAYS = 7;

export const slotKey = (date: ISODate, type: string) => `${date}|${type}`;

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

function scaled(t: TemplateSession, factor: number) {
  return { min: round5(t.duration_min * factor), max: round5(t.duration_max * factor) };
}

/**
 * Erzeugt alle geplanten Einheiten aus Phasen, Standardwoche,
 * Entlastungswochen, Rennen und manuellen Änderungen (Overrides).
 *
 * Regeln je Phasentyp:
 * - training: Standardwoche; in Entlastungswochen Dauer × Faktor (z. B. 0,6)
 * - pause:    keine Einheiten
 * - taper:    Standardwoche mit 50 % Dauer, keine Kraft in den letzten 7 Tagen vor dem Rennen
 * - race:     nur die Renntage
 * - recovery: nur Yoga & Mobility und eine lockere Gravel-Ausfahrt (50 %)
 * Renntage erzeugen immer eine Renn-Einheit und verdrängen andere Einheiten.
 */
export function generatePlan(input: PlanInput): PlannedSlot[] {
  const { phases, races, deloads, template, overrides } = input;
  const slots: PlannedSlot[] = [];
  const raceOn = (d: ISODate) => races.find((r) => isWithin(d, r.start_date, r.end_date));
  const nextRaceAfter = (d: ISODate) =>
    races.filter((r) => r.start_date > d).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const sortedPhases = [...phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const phaseOn = (d: ISODate) => sortedPhases.find((p) => isWithin(d, p.start_date, p.end_date));

  // Alle Tage, die von Phasen oder Rennen abgedeckt werden
  const days = new Set<ISODate>();
  for (const p of sortedPhases) for (const d of eachDay(p.start_date, p.end_date)) days.add(d);
  for (const r of races) for (const d of eachDay(r.start_date, r.end_date)) days.add(d);

  for (const d of [...days].sort()) {
    const phase = phaseOn(d);
    const race = raceOn(d);

    if (race) {
      const dayNo = diffDays(race.start_date, d) + 1;
      const total = diffDays(race.start_date, race.end_date) + 1;
      slots.push({
        slot_key: slotKey(d, "race"),
        original_date: d,
        date: d,
        start_time: null,
        session_type: "race",
        title: total > 1 ? `${race.name} – Tag ${dayNo}` : race.name,
        target_min: null,
        target_max: null,
        phase_id: phase?.id ?? null,
        race_id: race.id,
        volume_factor: 1,
        cancelled: false,
        note: null,
      });
      continue;
    }
    if (!phase || phase.kind === "pause" || phase.kind === "race") continue;

    const wd = isoWeekday(d);
    for (const t of template.filter((x) => x.weekday === wd)) {
      let factor = 1;
      let title = t.title;

      if (phase.kind === "training") {
        const deload = deloads.find((w) => isWithin(d, w.start_date, w.end_date));
        if (deload) {
          factor = Number(deload.volume_factor);
          title = `${t.title} (Entlastung)`;
        }
      } else if (phase.kind === "taper") {
        const next = nextRaceAfter(d);
        if (t.session_type === "strength" && next && diffDays(d, next.start_date) <= TAPER_NO_STRENGTH_DAYS) continue;
        factor = TAPER_FACTOR;
        title = t.session_type === "intervals" ? "Intervalle kurz (Tapering)" : `${t.title} (Tapering)`;
      } else if (phase.kind === "recovery") {
        if (t.session_type === "mobility") {
          factor = 1;
        } else if (t.session_type === "gravel") {
          factor = RECOVERY_FACTOR;
          title = "Gravel locker (Erholung)";
        } else continue;
      }

      const dur = scaled(t, factor);
      slots.push({
        slot_key: slotKey(d, t.session_type),
        original_date: d,
        date: d,
        start_time: t.start_time,
        session_type: t.session_type,
        title,
        target_min: dur.min,
        target_max: dur.max,
        phase_id: phase.id,
        race_id: null,
        volume_factor: factor,
        cancelled: false,
        note: null,
      });
    }
  }

  return applyOverrides(slots, overrides);
}

export function applyOverrides(slots: PlannedSlot[], overrides: PlanOverride[]): PlannedSlot[] {
  const byKey = new Map(overrides.map((o) => [o.slot_key, o]));
  return slots.map((s) => {
    const o = byKey.get(s.slot_key);
    if (!o) return s;
    if (o.action === "cancel") return { ...s, cancelled: true, note: o.note };
    return {
      ...s,
      date: o.new_date ?? s.date,
      start_time: o.new_time ?? s.start_time,
      note: o.note,
    };
  });
}

/** Phase, in der ein Datum liegt (oder undefined). */
export function phaseForDate(phases: Phase[], d: ISODate): Phase | undefined {
  return phases.find((p) => isWithin(d, p.start_date, p.end_date));
}

/** Woche x von y innerhalb der Phase. */
export function phaseWeek(phase: Phase, d: ISODate): { week: number; total: number } {
  return {
    week: Math.floor(diffDays(phase.start_date, d) / 7) + 1,
    total: Math.ceil((diffDays(phase.start_date, phase.end_date) + 1) / 7),
  };
}

