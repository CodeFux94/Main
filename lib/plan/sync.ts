import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeloads, getOverrides, getPhases, getRaces, getTemplate } from "@/lib/data";
import { generatePlan } from "./generate";

/**
 * Erzeugt den Plan aus den Plandaten neu und gleicht planned_sessions ab:
 * - neue/geänderte Einheiten werden per slot_key upserted
 * - nicht mehr vorhandene Einheiten werden gelöscht
 * Zuordnungen zu Strava-Aktivitäten (activity_id) bleiben erhalten.
 */
export async function syncPlan(sb: SupabaseClient): Promise<{ upserted: number; deleted: number }> {
  const [phases, races, deloads, template, overrides] = await Promise.all([
    getPhases(sb),
    getRaces(sb),
    getDeloads(sb),
    getTemplate(sb),
    getOverrides(sb),
  ]);
  const slots = generatePlan({ phases, races, deloads, template, overrides });
  const now = new Date().toISOString();

  for (let i = 0; i < slots.length; i += 500) {
    const chunk = slots.slice(i, i + 500).map((s) => ({ ...s, updated_at: now }));
    const { error } = await sb.from("planned_sessions").upsert(chunk, { onConflict: "slot_key" });
    if (error) throw new Error(`Plan speichern: ${error.message}`);
  }

  const wanted = new Set(slots.map((s) => s.slot_key));
  const { data: existing, error } = await sb.from("planned_sessions").select("id, slot_key");
  if (error) throw new Error(`Plan lesen: ${error.message}`);
  const stale = (existing ?? []).filter((r) => !wanted.has(r.slot_key)).map((r) => r.id as string);
  for (let i = 0; i < stale.length; i += 200) {
    const { error: delErr } = await sb.from("planned_sessions").delete().in("id", stale.slice(i, i + 200));
    if (delErr) throw new Error(`Plan bereinigen: ${delErr.message}`);
  }
  return { upserted: slots.length, deleted: stale.length };
}
