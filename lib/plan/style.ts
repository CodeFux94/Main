import type { SessionStatus, SessionType } from "./types";

export const TYPE_COLORS: Record<SessionType, string> = {
  strength: "#a78bfa", // violett
  intervals: "#f87171", // rot
  mobility: "#2dd4bf", // türkis
  enduro: "#fb923c", // orange
  gravel: "#a3e635", // limette
  race: "#facc15", // gelb
};

export const STATUS_CLASSES: Record<SessionStatus, string> = {
  planned: "bg-zinc-800 text-zinc-300",
  done: "bg-emerald-950 text-emerald-300",
  shifted: "bg-sky-950 text-sky-300",
  missed: "bg-red-950 text-red-300",
  cancelled: "bg-zinc-800 text-zinc-500 line-through",
};
