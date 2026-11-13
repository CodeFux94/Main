import type { ISODate } from "@/lib/dates";
import type { SessionStatus } from "./types";

interface StatusInput {
  date: ISODate;
  original_date: ISODate;
  cancelled: boolean;
  activity_id: number | null;
  /** Datum der zugeordneten Aktivität (falls vorhanden) */
  activity_date?: ISODate | null;
}

/**
 * Status einer Einheit:
 * - cancelled: abgesagt
 * - done:      Aktivität am (ggf. manuell verschobenen) Plantag
 * - shifted:   Aktivität an einem anderen Tag erledigt
 * - missed:    Tag vorbei, keine Aktivität
 * - planned:   noch offen
 */
export function sessionStatus(s: StatusInput, today: ISODate): SessionStatus {
  if (s.cancelled) return "cancelled";
  if (s.activity_id != null) {
    const actDate = s.activity_date ?? s.date;
    return actDate === s.date ? "done" : "shifted";
  }
  if (s.date < today) return "missed";
  return "planned";
}

export const isMoved = (s: { date: ISODate; original_date: ISODate }) => s.date !== s.original_date;
