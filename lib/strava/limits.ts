// Strava-Rate-Limits und Import-Konstanten (reine Funktionen, testbar).
//
// Strava begrenzt Anfragen pro 15 Minuten und pro Tag. Lesende Anfragen haben
// ein eigenes, niedrigeres Limit (Standard: 100 / 15 min, 1.000 / Tag).

export interface RateLimit {
  limit15: number;
  usage15: number;
  limitDay: number;
  usageDay: number;
}

/** Liest die Rate-Limit-Header. Das Lese-Limit hat Vorrang, falls vorhanden. */
export function parseRateLimit(h: Headers): RateLimit | null {
  const pick = (prefix: string) => {
    const l = h.get(`${prefix}-limit`);
    const u = h.get(`${prefix}-usage`);
    if (!l || !u) return null;
    const [limit15, limitDay] = l.split(",").map(Number);
    const [usage15, usageDay] = u.split(",").map(Number);
    if ([limit15, limitDay, usage15, usageDay].some((n) => !Number.isFinite(n))) return null;
    return { limit15, usage15, limitDay, usageDay };
  };
  return pick("x-readratelimit") ?? pick("x-ratelimit");
}

/** Sicherheitsabstand zum Limit, damit der Webhook immer noch Luft hat. */
export const RESERVE_15 = 10;
export const RESERVE_DAY = 50;

export function nearLimit(r: RateLimit | null): boolean {
  if (!r) return false;
  return r.usage15 >= r.limit15 - RESERVE_15 || r.usageDay >= r.limitDay - RESERVE_DAY;
}

/** Ende des aktuellen 15-Minuten-Fensters (Strava zählt ab :00, :15, :30, :45 UTC). */
export function nextWindow(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15 + 15);
  return d;
}

/** Erstimport ab 01.06.2026, 00:00 Uhr Berliner Zeit (= 31.05.2026 22:00 UTC). */
export const IMPORT_START_LOCAL = "2026-06-01";
export function importAfterEpoch(): number {
  return Date.UTC(2026, 4, 31, 22, 0, 0) / 1000;
}

export function formatUsage(r: RateLimit | null): string | null {
  return r ? `${r.usage15}/${r.limit15} (15 min) · ${r.usageDay}/${r.limitDay} (Tag)` : null;
}
