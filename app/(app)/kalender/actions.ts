"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { syncPlan } from "@/lib/plan/sync";
import { isISODate } from "@/lib/dates";
import { EDITABLE_SESSION_TYPES } from "@/lib/plan/types";

export interface ActionResult {
  ok?: string;
  error?: string;
}

const slotKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z]+$/);

function refresh() {
  revalidatePath("/", "layout");
}

export async function generatePlanAction(): Promise<ActionResult> {
  const { supabase } = await requireUser();
  try {
    const r = await syncPlan(supabase);
    refresh();
    return { ok: `${r.upserted} Einheiten erzeugt.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const changeSchema = z.object({
  slot_key: slotKeySchema,
  new_date: z.string().refine(isISODate, "Bitte ein gültiges Datum wählen."),
  new_time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Bitte eine gültige Uhrzeit wählen.")]),
  session_type: z.enum(EDITABLE_SESSION_TYPES as [string, ...string[]]),
  title: z.string().trim().max(80, "Titel ist zu lang."),
  duration_min: z.union([z.literal(""), z.coerce.number().int().min(5, "Dauer mind. 5 min.").max(600)]),
  duration_max: z.union([z.literal(""), z.coerce.number().int().min(5, "Dauer mind. 5 min.").max(600)]),
  note: z.string().trim().max(300, "Notiz ist zu lang."),
});

/**
 * Ändert eine Einheit: Datum, Uhrzeit, Art des Trainings, Titel und Dauer.
 * Die geänderte Art zählt für Strava-Zuordnung und Berichte.
 */
export async function changeSessionAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = changeSchema.safeParse({
    slot_key: str("slot_key"),
    new_date: str("new_date"),
    new_time: str("new_time"),
    session_type: str("session_type"),
    title: str("title"),
    duration_min: str("duration_min"),
    duration_max: str("duration_max"),
    note: str("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  const f = parsed.data;
  const dMin = f.duration_min === "" ? null : f.duration_min;
  const dMax = f.duration_max === "" ? null : f.duration_max;
  if (dMin != null && dMax != null && dMax < dMin) return { error: "Die maximale Dauer muss größer als die minimale sein." };

  const [originalDate, plannedType] = f.slot_key.split("|");
  const typeChanged = f.session_type !== plannedType;
  const unchanged =
    f.new_date === originalDate && !f.new_time && !typeChanged && !f.title && dMin == null && dMax == null && !f.note;
  const { error } = unchanged
    ? await supabase.from("plan_overrides").delete().eq("slot_key", f.slot_key)
    : await supabase.from("plan_overrides").upsert(
        {
          slot_key: f.slot_key,
          action: "move",
          new_date: f.new_date,
          new_time: f.new_time || null,
          note: f.note || null,
          new_session_type: typeChanged ? f.session_type : null,
          new_title: f.title || null,
          new_duration_min: dMin,
          new_duration_max: dMax,
        },
        { onConflict: "slot_key" },
      );
  if (error) {
    if (/new_session_type|new_title|new_duration|column/.test(error.message))
      return { error: "Datenbank noch nicht aktualisiert: bitte supabase/migrations/0004_session_changes.sql im Supabase SQL Editor ausführen." };
    return { error: error.message };
  }
  await syncPlan(supabase);
  refresh();
  return { ok: "Einheit geändert." };
}

export async function cancelSessionAction(slotKey: string, note?: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const key = slotKeySchema.safeParse(slotKey);
  if (!key.success) return { error: "Ungültige Einheit." };
  const { error } = await supabase
    .from("plan_overrides")
    .upsert({ slot_key: key.data, action: "cancel", new_date: null, new_time: null, note: note ?? "Abgesagt" }, { onConflict: "slot_key" });
  if (error) return { error: error.message };
  await syncPlan(supabase);
  refresh();
  return { ok: "Einheit abgesagt." };
}

/** Entfernt alle manuellen Änderungen an einer Einheit (zurück zum Plan). */
export async function resetSessionAction(slotKey: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const key = slotKeySchema.safeParse(slotKey);
  if (!key.success) return { error: "Ungültige Einheit." };
  const { error } = await supabase.from("plan_overrides").delete().eq("slot_key", key.data);
  if (error) return { error: error.message };
  await syncPlan(supabase);
  refresh();
  return { ok: "Einheit wiederhergestellt." };
}
