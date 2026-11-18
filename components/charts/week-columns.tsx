"use client";

import { useState } from "react";

export interface WeekColumn {
  key: string;
  /** Achsenbeschriftung, z. B. "KW 47" */
  label: string;
  value: number;
  /** optionale Soll-Spanne */
  rangeMin?: number;
  rangeMax?: number;
  /** laufende Woche (noch nicht abgeschlossen) */
  current?: boolean;
  /** Zeilen für Tooltip und Tabelle: [Bezeichnung, Wert] */
  details: [string, string][];
}

interface Props {
  title: string;
  /** Formatierung von Werten (Achse, Beschriftung) */
  unit: "h" | "trimp";
  columns: WeekColumn[];
  rangeLabel?: string;
}

const SERIES = "#3987e5"; // Kategorie-Slot 1 (dunkel)
const SERIES_CURRENT = "#86b6ef"; // hellere Stufe derselben Rampe = laufende Woche
const RANGE_FILL = "rgba(161,161,170,0.10)";
const RANGE_LINE = "#71717a";

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 100) / 100);
  if (ticks[ticks.length - 1] < max) ticks.push(Math.round((ticks[ticks.length - 1] + step) * 100) / 100);
  return ticks;
}

const fmt = (v: number, unit: Props["unit"]) =>
  unit === "h"
    ? `${v.toLocaleString("de-DE", { maximumFractionDigits: v < 10 ? 1 : 0 })} h`
    : v.toLocaleString("de-DE", { maximumFractionDigits: 0 });

export function WeekColumns({ title, unit, columns, rangeLabel }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...columns.map((c) => Math.max(c.value, c.rangeMax ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const pct = (v: number) => `${(v / top) * 100}%`;
  const hasRange = columns.some((c) => c.rangeMax);
  const activeCol = columns.find((c) => c.key === active);

  return (
    <figure className="card">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-semibold">{title}</span>
        {hasRange && (
          <span className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-2.5 rounded-sm" style={{ background: SERIES }} /> Ist
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3.5 rounded-sm border" style={{ background: RANGE_FILL, borderColor: RANGE_LINE }} /> {rangeLabel ?? "Soll"}
            </span>
          </span>
        )}
      </figcaption>

      <div className="relative h-40 pl-9" onPointerLeave={() => setActive(null)}>
        {/* Gitternetz + Achse */}
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute left-9 right-0" style={{ bottom: pct(t) }}>
            <div className={`border-t ${t === 0 ? "border-zinc-600" : "border-zinc-800"}`} />
            <span className="absolute -left-9 -translate-y-1/2 text-[10px] tabular-nums text-zinc-500" style={{ width: 32, textAlign: "right" }}>
              {fmt(t, unit).replace(" h", "")}
            </span>
          </div>
        ))}

        <div className="relative grid h-full items-end" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((c) => {
            const isActive = active === c.key;
            return (
              <button
                key={c.key}
                type="button"
                aria-label={`${c.label}: ${c.details.map(([k, v]) => `${k} ${v}`).join(", ")}`}
                onPointerEnter={() => setActive(c.key)}
                onFocus={() => setActive(c.key)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(isActive ? null : c.key)}
                className="relative flex h-full items-end justify-center outline-none focus-visible:bg-zinc-800/40"
              >
                {c.rangeMax ? (
                  <span
                    className="absolute w-[36px] max-w-[85%] rounded border"
                    style={{ bottom: pct(c.rangeMin ?? 0), height: pct(c.rangeMax - (c.rangeMin ?? 0)), minHeight: 3, background: RANGE_FILL, borderColor: RANGE_LINE }}
                  />
                ) : null}
                <span
                  className="relative w-6 max-w-[60%] rounded-t transition-opacity"
                  style={{
                    height: c.value > 0 ? pct(c.value) : 0,
                    background: c.current ? SERIES_CURRENT : SERIES,
                    opacity: active && !isActive ? 0.55 : 1,
                  }}
                />
                {c.current && c.value > 0 && (
                  <span
                    className="pointer-events-none absolute text-[11px] font-semibold text-zinc-200"
                    style={{ bottom: `calc(${pct(c.value)} + 4px)` }}
                  >
                    {fmt(c.value, unit)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeCol && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-xl"
            style={{
              left: `calc(36px + (100% - 36px) * ${(columns.indexOf(activeCol) + 0.5) / columns.length})`,
              transform: `translateX(${columns.indexOf(activeCol) < columns.length / 2 ? "-10%" : "-90%"})`,
            }}
          >
            <div className="mb-1 text-zinc-400">{activeCol.label}{activeCol.current ? " (läuft)" : ""}</div>
            {activeCol.details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-zinc-400">{k}</span>
                <span className="font-semibold text-zinc-100">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 grid pl-9 text-center text-[10px] text-zinc-500" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((c) => (
          <span key={c.key} className={c.current ? "font-semibold text-zinc-300" : ""}>{c.label}</span>
        ))}
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-zinc-500">Als Tabelle</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Woche</th>
                {columns[0]?.details.map(([k]) => <th key={k} className="py-1 pr-3 font-medium">{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.key} className="border-t border-zinc-800">
                  <td className="py-1 pr-3 text-zinc-400">{c.label}</td>
                  {c.details.map(([k, v]) => <td key={k} className="py-1 pr-3">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
