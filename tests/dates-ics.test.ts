import { describe, expect, it } from "vitest";
import {
  addDays, endOfMonth, formatMinutes, formatRange, isoWeekNumber, isoWeekday, startOfWeek, todayISO,
} from "@/lib/dates";
import { buildIcs } from "@/lib/ics";

describe("Datums-Hilfen", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-28", 1)).toBe("2027-03-29"); // Sommerzeit egal
    expect(endOfMonth("2027-02-10")).toBe("2027-02-28");
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16");
    expect(isoWeekday("2026-11-22")).toBe(7);
    expect(isoWeekNumber("2026-11-16")).toBe(47);
    expect(isoWeekNumber("2027-01-04")).toBe(1);
  });
  it("bestimmt heute in Europe/Berlin", () => {
    // 23:30 UTC am 31.12. ist in Berlin schon Neujahr
    expect(todayISO(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
  it("formatiert Dauern", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(150)).toBe("2:30 h");
    expect(formatRange(150, 240)).toBe("2,5–4 h");
    expect(formatRange(45, 60)).toBe("45–60 min");
    expect(formatRange(60, 60)).toBe("60 min");
  });
});

describe("ICS", () => {
  const ics = buildIcs(
    "Enduro One 2027",
    [
      { uid: "a@x", title: "Kraft A", date: "2026-11-17", startTime: "18:00", durationMin: 60, description: "Ziel: 45–60 min, Phase 1" },
      { uid: "b@x", title: "Enduro One Schulenberg", date: "2027-06-25", endDate: "2027-06-28" },
      { uid: "c@x", title: "Spät", date: "2026-11-17", startTime: "23:30", durationMin: 60 },
    ],
    new Date("2026-11-12T10:00:00Z"),
  );
  it("enthält Kalender-Header und CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("schreibt lokale Zeiten mit TZID und maskiert Kommas", () => {
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20261117T180000");
    expect(ics).toContain("DTEND;TZID=Europe/Berlin:20261117T190000");
    expect(ics).toContain("DESCRIPTION:Ziel: 45–60 min\\, Phase 1");
    expect(ics).toContain("DTEND;TZID=Europe/Berlin:20261118T003000");
  });
  it("legt mehrtägige Rennen ganztägig an (DTEND exklusiv)", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20270625");
    expect(ics).toContain("DTEND;VALUE=DATE:20270629");
  });
  it("faltet lange Zeilen auf max. 75 Oktette", () => {
    const long = buildIcs("x", [{ uid: "l", title: "Ä".repeat(100), date: "2026-11-17" }]);
    for (const line of long.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
