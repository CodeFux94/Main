// Umwandlung von Strava-API-Daten in Datenbankzeilen (reine Funktionen).

/** Teilmenge der Strava "SummaryActivity"/"DetailedActivity". */
export interface StravaActivity {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date: string; // UTC, z. B. "2026-11-17T17:02:11Z"
  start_date_local: string; // lokale Zeit mit irreführendem "Z"
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  max_watts?: number;
  kilojoules?: number;
  device_watts?: boolean;
  has_heartrate?: boolean;
  trainer?: boolean;
  manual?: boolean;
  athlete?: { id: number };
  [key: string]: unknown;
}

export interface ActivityRow {
  id: number;
  name: string;
  sport_type: string;
  type: string | null;
  start_date: string;
  start_date_local: string;
  local_date: string;
  moving_time_s: number;
  elapsed_time_s: number;
  distance_m: number;
  elevation_gain_m: number;
  avg_hr: number | null;
  max_hr: number | null;
  avg_watts: number | null;
  weighted_avg_watts: number | null;
  max_watts: number | null;
  kilojoules: number | null;
  device_watts: boolean;
  has_heartrate: boolean;
  trainer: boolean;
  manual: boolean;
  raw: Record<string, unknown>;
  deleted_at: null;
  updated_at: string;
}

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

export function mapActivity(a: StravaActivity, now: Date = new Date()): ActivityRow {
  const local = a.start_date_local.replace(/Z$/, "").slice(0, 19);
  // Große/unnötige Felder nicht speichern
  const { map: _map, segment_efforts: _se, splits_metric: _sm, splits_standard: _ss, laps: _laps, best_efforts: _be, photos: _ph, ...raw } = a as Record<string, unknown>;
  void _map; void _se; void _sm; void _ss; void _laps; void _be; void _ph;
  return {
    id: a.id,
    name: a.name ?? "",
    sport_type: a.sport_type ?? a.type ?? "Workout",
    type: a.type ?? null,
    start_date: a.start_date,
    start_date_local: local,
    local_date: local.slice(0, 10),
    moving_time_s: Math.round(a.moving_time ?? 0),
    elapsed_time_s: Math.round(a.elapsed_time ?? 0),
    distance_m: round1(a.distance ?? 0)!,
    elevation_gain_m: round1(a.total_elevation_gain ?? 0)!,
    avg_hr: round1(numOrNull(a.average_heartrate)),
    max_hr: round1(numOrNull(a.max_heartrate)),
    avg_watts: round1(numOrNull(a.average_watts)),
    weighted_avg_watts: round1(numOrNull(a.weighted_average_watts)),
    max_watts: round1(numOrNull(a.max_watts)),
    kilojoules: round1(numOrNull(a.kilojoules)),
    device_watts: Boolean(a.device_watts),
    has_heartrate: Boolean(a.has_heartrate),
    trainer: Boolean(a.trainer),
    manual: Boolean(a.manual),
    raw,
    deleted_at: null,
    updated_at: now.toISOString(),
  };
}

/**
 * Baut aus den Strava-Streams (time, heartrate) ein Histogramm
 * { bpm: Sekunden }. Lücken > 30 s (Pause/Auto-Pause) zählen nicht.
 */
export function buildHrHistogram(time: number[], hr: number[], maxGap = 30): Record<string, number> {
  const hist: Record<string, number> = {};
  const n = Math.min(time.length, hr.length);
  for (let i = 0; i < n - 1; i++) {
    const dt = time[i + 1] - time[i];
    if (dt <= 0 || dt > maxGap) continue;
    const bpm = Math.round(hr[i]);
    if (!(bpm > 30 && bpm < 240)) continue;
    hist[bpm] = (hist[bpm] ?? 0) + dt;
  }
  return hist;
}

/** Sekunden je Zone (Z1..Z5) aus dem Histogramm – identisch zur SQL-Funktion. */
export function zoneSecondsFromHistogram(
  hist: Record<string, number>,
  z: { hr_z2: number; hr_z3: number; hr_z4: number; hr_z5: number },
): [number, number, number, number, number] {
  const out: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const [k, secs] of Object.entries(hist)) {
    const bpm = Number(k);
    const idx = bpm < z.hr_z2 ? 0 : bpm < z.hr_z3 ? 1 : bpm < z.hr_z4 ? 2 : bpm < z.hr_z5 ? 3 : 4;
    out[idx] += secs;
  }
  return out;
}

/** Edwards-TRIMP aus Sekunden je Zone. */
export const trimpFromZones = (zs: number[]) =>
  Math.round(((zs[0] * 1 + zs[1] * 2 + zs[2] * 3 + zs[3] * 4 + zs[4] * 5) / 60) * 10) / 10;
