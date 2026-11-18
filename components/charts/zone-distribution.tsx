import { formatMinutes } from "@/lib/dates";
import { intensitySplit } from "@/lib/metrics/weekly";
import { ZONE_COLORS, ZONE_TEXT } from "@/components/activity-line";

interface Props {
  title: string;
  zones: number[];
  bounds: { hr_z2: number; hr_z3: number; hr_z4: number; hr_z5: number };
}

/** Zeit in HF-Zonen als segmentierter Balken (ein Ganzes, fünf Teile). */
export function ZoneDistribution({ title, zones, bounds }: Props) {
  const total = zones.reduce((s, x) => s + x, 0);
  const split = intensitySplit(zones);
  const ranges = [
    `< ${bounds.hr_z2}`,
    `${bounds.hr_z2}–${bounds.hr_z3 - 1}`,
    `${bounds.hr_z3}–${bounds.hr_z4 - 1}`,
    `${bounds.hr_z4}–${bounds.hr_z5 - 1}`,
    `≥ ${bounds.hr_z5}`,
  ];
  return (
    <figure className="card">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      {total === 0 ? (
        <p className="text-sm text-zinc-500">Noch keine Herzfrequenzdaten in diesem Zeitraum.</p>
      ) : (
        <>
          <div
            className="flex h-7 gap-[2px]"
            role="img"
            aria-label={zones.map((z, i) => `Z${i + 1}: ${Math.round((z / total) * 100)} %`).join(", ")}
          >
            {zones.map((z, i) => {
              const share = z / total;
              if (share <= 0) return null;
              return (
                <div
                  key={i}
                  title={`Z${i + 1} (${ranges[i]} bpm): ${formatMinutes(z / 60)} · ${Math.round(share * 100)} %`}
                  className="flex items-center overflow-hidden rounded px-1.5 text-[11px] font-semibold"
                  style={{ width: `${share * 100}%`, background: ZONE_COLORS[i], color: ZONE_TEXT[i] }}
                >
                  {share >= 0.09 ? `${Math.round(share * 100)} %` : ""}
                </div>
              );
            })}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-3">
            {zones.map((z, i) => (
              <li key={i} className="flex items-center gap-1.5 whitespace-nowrap text-zinc-400">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ZONE_COLORS[i] }} />
                <span className="text-zinc-200">Z{i + 1}</span>
                <span className="text-zinc-500">{ranges[i]}</span>
                <span className="ml-auto tabular-nums">{formatMinutes(z / 60)}</span>
              </li>
            ))}
          </ul>
          {split && (
            <p className="mt-3 text-xs text-zinc-400">
              Locker (Z1–2) <b className="text-zinc-200">{split.easy} %</b> · Mittel (Z3){" "}
              <b className="text-zinc-200">{split.moderate} %</b> · Hart (Z4–5){" "}
              <b className="text-zinc-200">{split.hard} %</b>
            </p>
          )}
        </>
      )}
    </figure>
  );
}
