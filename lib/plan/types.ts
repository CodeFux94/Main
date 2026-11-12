import type { ISODate } from "@/lib/dates";

export const SESSION_TYPES = ["strength", "intervals", "mobility", "enduro", "gravel", "race"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  strength: "Kraft",
  intervals: "Intervalle",
  mobility: "Yoga & Mobility",
  enduro: "Enduro",
  gravel: "Gravel",
  race: "Rennen",
};

export const PHASE_KINDS = ["training", "pause", "taper", "race", "recovery"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PHASE_KIND_LABELS: Record<PhaseKind, string> = {
  training: "Training",
  pause: "Pause",
  taper: "Tapering",
  race: "Rennen",
  recovery: "Erholung",
};

export interface Phase {
  id: string;
  name: string;
  kind: PhaseKind;
  start_date: ISODate;
  end_date: ISODate;
  color: string;
  focus: string | null;
}

export interface Race {
  id: string;
  name: string;
  location: string | null;
  start_date: ISODate;
  end_date: ISODate;
}

export interface DeloadWeek {
  id: string;
  start_date: ISODate;
  end_date: ISODate;
  volume_factor: number;
}

export interface TemplateSession {
  id: string;
  weekday: number; // 1 = Mo … 7 = So
  session_type: SessionType;
  title: string;
  start_time: string; // "18:00"
  duration_min: number;
  duration_max: number;
}

export interface PlanOverride {
  id?: string;
  slot_key: string;
  action: "cancel" | "move";
  new_date: ISODate | null;
  new_time: string | null;
  note: string | null;
}

/** Eine vom Generator erzeugte Einheit. */
export interface PlannedSlot {
  slot_key: string; // `${original_date}|${session_type}`
  original_date: ISODate;
  date: ISODate;
  start_time: string | null;
  session_type: SessionType;
  title: string;
  target_min: number | null;
  target_max: number | null;
  phase_id: string | null;
  race_id: string | null;
  volume_factor: number;
  cancelled: boolean;
  note: string | null;
}

/** Datensatz aus der Tabelle planned_sessions. */
export interface PlannedSession extends PlannedSlot {
  id: string;
  activity_id: number | null;
}

export type SessionStatus = "planned" | "done" | "shifted" | "missed" | "cancelled";

export const STATUS_LABELS: Record<SessionStatus, string> = {
  planned: "geplant",
  done: "erledigt",
  shifted: "verschoben",
  missed: "verpasst",
  cancelled: "abgesagt",
};
