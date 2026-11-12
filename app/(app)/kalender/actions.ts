"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data";
import { syncPlan } from "@/lib/plan/sync";
import { isISODate } from "@/lib/dates";

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

export async function moveSessionAction(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const slotKey = slotKeySchema.safeParse(formData.get("slot_key"));
  const newDate = String(formData.get("new_date") ?? "");
  const newTime = String(formData.get("new_time") ?? "");
  if (!slotKey.success) return { error: "Ungültige Einheit." };
  if (!isISODate(newDate)) return { error: "Bitte ein gültiges Datum wählen." };
  if (newTime && !/^\d{2}:\d{2}$/.test(newTime)) return { error: "Bitte eine gültige Uhrzeit wählen." };

  const originalDate = slotKey.data.split("|")[0];
  const sameAsOriginal = newDate === originalDate && !newTime;
  const { error } = sameAsOriginal
    ? await supabase.from("plan_overrides").delete().eq("slot_key", slotKey.data)
    : await supabase.from("plan_overrides").upsert(
        {
          slot_key: slotKey.data,
          action: "move",
          new_date: newDate,
          new_time: newTime || null,
          note: String(formData.get("note") ?? "").trim() || null,
        },
        { onConflict: "slot_key" },
      );
  if (error) return { error: error.message };
  await syncPlan(supabase);
  refresh();
  return { ok: "Einheit verschoben." };
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
