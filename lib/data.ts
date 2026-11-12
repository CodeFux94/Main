import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { ISODate } from "@/lib/dates";
import type { DeloadWeek, Phase, PlanOverride, PlannedSession, Race, TemplateSession } from "@/lib/plan/types";

export interface Settings {
  id: number;
  ftp_w: number;
  weight_kg: number;
  hr_z2: number;
  hr_z3: number;
  hr_z4: number;
  hr_z5: number;
  timezone: string;
  ics_token: string;
}

/** Prüft die Sitzung und liefert einen Supabase-Client des Nutzers. */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return { supabase, email: (data.claims.email as string | undefined) ?? null };
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

const num = (v: unknown) => (v == null ? v : Number(v));
const time = (v: string | null) => (v ? v.slice(0, 5) : v);

export async function getSettings(sb: SupabaseClient): Promise<Settings> {
  const s = unwrap(await sb.from("settings").select("*").eq("id", 1).single(), "Einstellungen") as Settings;
  return { ...s, weight_kg: Number(s.weight_kg) };
}

export async function getPhases(sb: SupabaseClient): Promise<Phase[]> {
  return unwrap(await sb.from("phases").select("*").order("start_date"), "Phasen") as Phase[];
}

export async function getRaces(sb: SupabaseClient): Promise<Race[]> {
  return unwrap(await sb.from("races").select("*").order("start_date"), "Rennen") as Race[];
}

export async function getDeloads(sb: SupabaseClient): Promise<DeloadWeek[]> {
  const rows = unwrap(await sb.from("deload_weeks").select("*").order("start_date"), "Entlastungswochen") as DeloadWeek[];
  return rows.map((r) => ({ ...r, volume_factor: Number(r.volume_factor) }));
}

export async function getTemplate(sb: SupabaseClient): Promise<TemplateSession[]> {
  const rows = unwrap(
    await sb.from("week_template").select("*").order("weekday").order("start_time"),
    "Standardwoche",
  ) as TemplateSession[];
  return rows.map((r) => ({ ...r, start_time: time(r.start_time)! }));
}

export async function getOverrides(sb: SupabaseClient): Promise<PlanOverride[]> {
  const rows = unwrap(await sb.from("plan_overrides").select("*"), "Planänderungen") as PlanOverride[];
  return rows.map((r) => ({ ...r, new_time: time(r.new_time) }));
}

function normalizeSession(r: PlannedSession): PlannedSession {
  return {
    ...r,
    start_time: time(r.start_time),
    volume_factor: Number(r.volume_factor),
    activity_id: num(r.activity_id) as number | null,
  };
}

export async function getSessions(sb: SupabaseClient, from: ISODate, to: ISODate): Promise<PlannedSession[]> {
  const rows = unwrap(
    await sb
      .from("planned_sessions")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time", { nullsFirst: true }),
    "Einheiten",
  ) as PlannedSession[];
  return rows.map(normalizeSession);
}

export async function countSessions(sb: SupabaseClient): Promise<number> {
  const { count, error } = await sb.from("planned_sessions").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Einheiten: ${error.message}`);
  return count ?? 0;
}
