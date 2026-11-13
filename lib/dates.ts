// Datums-Hilfen auf Basis von ISO-Datumsstrings ("YYYY-MM-DD").
// Intern wird mit UTC-Mitternacht gerechnet, damit Zeitzonen und
// Sommerzeit keine Rolle spielen. "Heute" wird in Europe/Berlin bestimmt.

export const APP_TIMEZONE = "Europe/Berlin";

export type ISODate = string; // "YYYY-MM-DD"

const DAY_MS = 86_400_000;

export function parseISODate(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISODate(new Date(parseISODate(d).getTime() + n * DAY_MS));
}

/** Differenz in Tagen: b - a */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

/** Wochentag mit Montag = 1 … Sonntag = 7 (ISO). */
export function isoWeekday(d: ISODate): number {
  const wd = parseISODate(d).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, 1 - isoWeekday(d));
}

export function endOfWeek(d: ISODate): ISODate {
  return addDays(startOfWeek(d), 6);
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + "01";
}

export function addMonths(d: ISODate, n: number): ISODate {
  const date = parseISODate(startOfMonth(d));
  date.setUTCMonth(date.getUTCMonth() + n);
  return toISODate(date);
}

export function endOfMonth(d: ISODate): ISODate {
  return addDays(addMonths(d, 1), -1);
}

/** Alle Tage von start bis end (inklusive). */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isWithin(d: ISODate, start: ISODate, end: ISODate): boolean {
  return d >= start && d <= end;
}

/** ISO-Kalenderwoche */
export function isoWeekNumber(d: ISODate): number {
  const thursday = addDays(d, 4 - isoWeekday(d));
  const yearStart = thursday.slice(0, 4) + "-01-01";
  return Math.floor(diffDays(yearStart, thursday) / 7) + 1;
}

/** Heutiges Datum in der App-Zeitzone. */
export function todayISO(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISODate(s).getTime());
}

// ---------- Formatierung (Deutsch) ----------

function fmt(d: ISODate, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", ...opts }).format(parseISODate(d));
}

/** "Mo, 16.11." */
export const formatShort = (d: ISODate) => fmt(d, { weekday: "short", day: "2-digit", month: "2-digit" });
/** "16.11.2026" */
export const formatDate = (d: ISODate) => fmt(d, { day: "2-digit", month: "2-digit", year: "numeric" });
/** "Montag, 16. November 2026" */
export const formatLong = (d: ISODate) => fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** "November 2026" */
export const formatMonth = (d: ISODate) => fmt(d, { month: "long", year: "numeric" });
/** "16.11." */
export const formatDayMonth = (d: ISODate) => fmt(d, { day: "2-digit", month: "2-digit" });

export const WEEKDAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Minuten → "2:30 h" bzw. "45 min" */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "–";
  if (min < 90) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
}

export function formatRange(minA: number | null, minB: number | null): string {
  if (minA == null && minB == null) return "";
  if (minA == null || minB == null || minA === minB) return formatMinutes(minA ?? minB);
  if (minA >= 90 && minB >= 90) {
    const h = (x: number) => (x / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 });
    return `${h(minA)}–${h(minB)} h`;
  }
  return `${Math.round(minA)}–${Math.round(minB)} min`;
}

/** "18:00:00" → "18:00" */
export function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}
