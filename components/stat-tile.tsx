import type { ReactNode } from "react";

/** Kennzahl-Kachel: Bezeichnung · Wert · optionale Veränderung · optionaler Zusatz. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  sub,
  children,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Veränderung in %, neutral eingefärbt (mehr ist nicht automatisch besser) */
  delta?: number | null;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="card p-3.5">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-zinc-50">{value}</span>
        {unit && <span className="text-sm text-zinc-400">{unit}</span>}
      </div>
      {delta != null && (
        <div className="mt-0.5 text-xs text-zinc-400">
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {delta > 0 ? "+" : ""}
          {delta} %
        </div>
      )}
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
      {children}
    </div>
  );
}
