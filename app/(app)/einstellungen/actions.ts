"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { syncPlan } from "@/lib/plan/sync";
import { PHASE_KINDS } from "@/lib/plan/types";
import type { FormResult } from "@/components/action-form";

const date = z.iso.date({ error: "Ungültiges Datum" });
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Ungültige Uhrzeit");
const int = (min: number, max: number, name: string) =>
  z.coerce.number({ error: `${name}: Zahl erwartet` }).int(`${name}: ganze Zahl erwartet`).min(min, `${name} zu klein`).max(max, `${name} zu groß`);

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Ungültige Eingabe";
}

function refresh() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- Profil & Zonen

const profileSchema = z.object({
  ftp_w: int(50, 600, "FTP"),
  weight_kg: z.coerce.number({ error: "Gewicht: Zahl erwartet" }).min(30, "Gewicht zu klein").max(250, "Gewicht zu groß"),
});

export async function saveProfileAction(_: FormResult, fd: FormData): Promise<FormResult> {
  const parsed = profileSchema.safeParse({ ftp_w: fd.get("ftp_w"), weight_kg: String(fd.get("weight_kg")).replace(",", ".") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("settings").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Gespeichert." };
}

const zonesSchema = z
  .object({
    hr_z2: int(60, 230, "Z2"),
    hr_z3: int(60, 230, "Z3"),
    hr_z4: int(60, 230, "Z4"),
    hr_z5: int(60, 230, "Z5"),
  })
  .refine((z) => z.hr_z2 < z.hr_z3 && z.hr_z3 < z.hr_z4 && z.hr_z4 < z.hr_z5, "Zonen müssen aufsteigend sein.");

export async function saveZonesAction(_: FormResult, fd: FormData): Promise<FormResult> {
  const parsed = zonesSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("settings").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Zonen gespeichert." };
}

export async function rotateIcsTokenAction(): Promise<FormResult> {
  const { supabase } = await requireUser();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  const { error } = await supabase.from("settings").update({ ics_token: token }).eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Neuer Link erzeugt – altes Abo im Kalender bitte löschen und neu abonnieren." };
}

// ---------------------------------------------------------------- Plan bearbeiten

const dateRange = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ start_date: date, end_date: date, ...shape })
    .refine((v) => {
      const r = v as { start_date: string; end_date: string };
      return r.end_date >= r.start_date;
    }, "Ende muss nach dem Start liegen.");

const schemas = {
  races: dateRange({
    name: z.string().trim().min(1, "Name fehlt"),
    location: z.string().trim().optional().transform((v) => v || null),
  }),
  phases: dateRange({
    name: z.string().trim().min(1, "Name fehlt"),
    kind: z.enum(PHASE_KINDS),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Farbe ungültig"),
    focus: z.string().trim().optional().transform((v) => v || null),
  }),
  deload_weeks: dateRange({
    volume_factor: z.coerce.number().min(0.1, "Faktor zu klein").max(1, "Faktor max. 1"),
  }),
  week_template: z
    .object({
      weekday: int(1, 7, "Wochentag"),
      session_type: z.enum(["strength", "intervals", "mobility", "enduro", "gravel"]),
      title: z.string().trim().min(1, "Titel fehlt"),
      start_time: time,
      duration_min: int(5, 600, "Dauer min"),
      duration_max: int(5, 600, "Dauer max"),
    })
    .refine((v) => v.duration_max >= v.duration_min, "Max-Dauer muss ≥ Min-Dauer sein."),
} as const;

type PlanTable = keyof typeof schemas | "plan_overrides";
const TABLES = [...Object.keys(schemas), "plan_overrides"] as PlanTable[];

const isPlanTable = (t: unknown): t is PlanTable => TABLES.includes(t as PlanTable);

/** Speichert (id gesetzt) oder legt an (ohne id) und erzeugt den Plan neu. */
export async function savePlanRowAction(_: FormResult, fd: FormData): Promise<FormResult> {
  const table = fd.get("_table");
  if (!isPlanTable(table) || table === "plan_overrides") return { error: "Unbekannte Tabelle" };
  const id = String(fd.get("id") ?? "");
  const raw = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("_") && k !== "id" && !k.startsWith("$")));
  if (table === "deload_weeks" && typeof raw.volume_factor === "string") raw.volume_factor = raw.volume_factor.replace(",", ".");
  const parsed = schemas[table].safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const row = parsed.data as Record<string, unknown>;
  const { error } = id
    ? await supabase.from(table).update(row).eq("id", id)
    : await supabase.from(table).insert(row);
  if (error) {
    if (error.code === "23505") return { error: "An diesem Wochentag gibt es diesen Typ schon." };
    return { error: error.message };
  }
  try {
    await syncPlan(supabase);
  } catch (e) {
    return { error: `Gespeichert, aber Plan konnte nicht neu erzeugt werden: ${(e as Error).message}` };
  }
  refresh();
  return { ok: id ? "Gespeichert, Plan aktualisiert." : "Angelegt, Plan aktualisiert." };
}

export async function deletePlanRowAction(table: string, id: string): Promise<FormResult> {
  if (!isPlanTable(table) || !z.uuid().safeParse(id).success) return { error: "Ungültige Anfrage" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: error.message };
  await syncPlan(supabase);
  refresh();
  return { ok: "Gelöscht, Plan aktualisiert." };
}

export async function regeneratePlanAction(): Promise<FormResult> {
  const { supabase } = await requireUser();
  try {
    const r = await syncPlan(supabase);
    refresh();
    return { ok: `Plan neu erzeugt: ${r.upserted} Einheiten${r.deleted ? `, ${r.deleted} entfernt` : ""}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
