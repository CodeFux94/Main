// Erzeugt supabase/seed.sql aus lib/plan/seed-data.ts
// Aufruf: npm run seed:sql
import { writeFileSync } from "node:fs";
import { SEED_DELOADS, SEED_OVERRIDES, SEED_PHASES, SEED_RACES, SEED_SETTINGS, SEED_TEMPLATE } from "../lib/plan/seed-data";

const q = (v: unknown) => (v == null ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const row = (vals: unknown[]) => `  (${vals.map(q).join(", ")})`;

const out: string[] = [
  "-- Ausgangsplan Enduro One 2027 (generiert aus lib/plan/seed-data.ts – nicht von Hand bearbeiten)",
  "-- Ausführen NACH der Migration. Kann gefahrlos mehrfach ausgeführt werden.",
  "",
  `update public.settings set ftp_w = ${SEED_SETTINGS.ftp_w}, weight_kg = ${SEED_SETTINGS.weight_kg}, hr_z2 = ${SEED_SETTINGS.hr_z2}, hr_z3 = ${SEED_SETTINGS.hr_z3}, hr_z4 = ${SEED_SETTINGS.hr_z4}, hr_z5 = ${SEED_SETTINGS.hr_z5} where id = 1;`,
  "",
  "insert into public.races (id, name, location, start_date, end_date) values",
  SEED_RACES.map((r) => row([r.id, r.name, r.location, r.start_date, r.end_date])).join(",\n"),
  "on conflict (id) do nothing;",
  "",
  "insert into public.phases (id, name, kind, start_date, end_date, color, focus) values",
  SEED_PHASES.map((p) => row([p.id, p.name, p.kind, p.start_date, p.end_date, p.color, p.focus])).join(",\n"),
  "on conflict (id) do nothing;",
  "",
  "insert into public.deload_weeks (id, start_date, end_date, volume_factor) values",
  SEED_DELOADS.map((d) => row([d.id, d.start_date, d.end_date, d.volume_factor])).join(",\n"),
  "on conflict (id) do nothing;",
  "",
  "insert into public.week_template (id, weekday, session_type, title, start_time, duration_min, duration_max) values",
  SEED_TEMPLATE.map((t) => row([t.id, t.weekday, t.session_type, t.title, t.start_time, t.duration_min, t.duration_max])).join(",\n"),
  "on conflict do nothing;",
  "",
  "insert into public.plan_overrides (slot_key, action, new_date, new_time, note) values",
  SEED_OVERRIDES.map((o) => row([o.slot_key, o.action, o.new_date, o.new_time, o.note])).join(",\n"),
  "on conflict (slot_key) do nothing;",
  "",
];

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n"));
console.log("supabase/seed.sql geschrieben");
