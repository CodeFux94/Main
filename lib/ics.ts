// Minimaler iCalendar-Generator (RFC 5545) für den Abo-Feed im Apple Kalender.
import { addDays, type ISODate } from "@/lib/dates";

export interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  /** Datum der Einheit */
  date: ISODate;
  /** "HH:MM" – fehlt = ganztägig */
  startTime?: string | null;
  durationMin?: number | null;
  /** Für ganztägige Mehrtagesereignisse (inklusive) */
  endDate?: ISODate;
}

const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Zeilen auf 75 Oktette falten (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let len = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (len + l > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      len = 0;
    }
    current += ch;
    len += l;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (d: ISODate) => d.replace(/-/g, "");

function localDateTime(d: ISODate, time: string, addMin = 0): string {
  const [h, m] = time.split(":").map(Number);
  let total = h * 60 + m + addMin;
  let day = d;
  while (total >= 1440) {
    total -= 1440;
    day = addDays(day, 1);
  }
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${compactDate(day)}T${hh}${mm}00`;
}

const VTIMEZONE_BERLIN = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export function buildIcs(calName: string, events: IcsEvent[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Enduro One 2027//Trainingsplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(calName)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...VTIMEZONE_BERLIN,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${escape(e.title)}`);
    if (e.startTime) {
      const dur = e.durationMin ?? 60;
      lines.push(
        `DTSTART;TZID=Europe/Berlin:${localDateTime(e.date, e.startTime)}`,
        `DTEND;TZID=Europe/Berlin:${localDateTime(e.date, e.startTime, dur)}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(e.endDate ?? e.date, 1))}`,
      );
    }
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
