import { formatMinutes } from "@/lib/dates";
import type { ActivitySummary } from "@/lib/plan/types";

export const ZONE_COLORS = ["#71717a", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444"];

const SPORT_LABELS: Record<string, string> = {
  Ride: "Rad",
  MountainBikeRide: "MTB",
  EMountainBikeRide: "E-MTB",
  GravelRide: "Gravel",
  VirtualRide: "Indoor",
  EBikeRide: "E-Bike",
  WeightTraining: "Kraft",
  Workout: "Workout",
  Yoga: "Yoga",
  Run: "Lauf",
  Walk: "Gehen",
  Hike: "Wandern",
};
export const sportLabel = (s: string) => SPORT_LABELS[s] ?? s;

const nf = (v: number, digits = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: digits });

/** Kennzahlen einer Strava-Aktivität in einer Zeile. */
export function activityStats(a: ActivitySummary): string[] {
  const out = [formatMinutes(a.moving_time_s / 60)];
  if (a.distance_m > 100) out.push(`${nf(a.distance_m / 1000, 1)} km`);
  if (a.elevation_gain_m >= 1) out.push(`${nf(a.elevation_gain_m)} hm`);
  if (a.avg_hr) out.push(`Ø ${nf(a.avg_hr)}${a.max_hr ? `/${nf(a.max_hr)}` : ""} bpm`);
  const w = a.weighted_avg_watts ?? a.avg_watts;
  if (w) out.push(`${nf(w)} W`);
  return out;
}

export function ZoneBar({ zones, className = "" }: { zones: number[] | null; className?: string }) {
  const total = zones?.reduce((s, x) => s + x, 0) ?? 0;
  if (!zones || total === 0) return null;
  return (
    <div className={`flex h-1.5 overflow-hidden rounded-full bg-zinc-800 ${className}`} title="Zeit in HF-Zonen Z1–Z5">
      {zones.map((z, i) => (
        <div key={i} style={{ width: `${(z / total) * 100}%`, background: ZONE_COLORS[i] }} />
      ))}
    </div>
  );
}

export function ActivityLine({ a, showName = true }: { a: ActivitySummary; showName?: boolean }) {
  return (
    <div className="text-xs text-zinc-400">
      {showName && (
        <a
          href={`https://www.strava.com/activities/${a.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-orange-400 hover:underline"
        >
          {a.name || sportLabel(a.sport_type)} ↗
        </a>
      )}
      <div className="mt-0.5">
        {sportLabel(a.sport_type)} · {activityStats(a).join(" · ")}
      </div>
      <ZoneBar zones={a.zone_seconds} className="mt-1.5" />
    </div>
  );
}
