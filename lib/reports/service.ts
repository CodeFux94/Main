import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActivities, getDeloads, getPhases, getRaces, getSessions, getSettings } from "@/lib/data";
import { isMissingSchema } from "@/lib/db-errors";
import { IMPORT_START_LOCAL } from "@/lib/strava/limits";
import {
  buildPhaseReport, buildWeeklyReport, duePhases, dueWeeks, type PhaseReportData, type ReportContext, type WeeklyReportData,
} from "./build";

export const REPORTS_MIGRATION_HINT =
  "Datenbank noch nicht erweitert: Bitte im Supabase SQL Editor supabase/migrations/0003_reports.sql ausführen.";

export async function loadReportContext(sb: SupabaseClient, today: string): Promise<ReportContext> {
  const [phases, races, deloads, settings] = await Promise.all([getPhases(sb), getRaces(sb), getDeloads(sb), getSettings(sb)]);
  const planStart = phases[0]?.start_date ?? today;
  const planEnd = phases[phases.length - 1]?.end_date ?? today;
  const [sessions, activities] = await Promise.all([
    getSessions(sb, planStart, planEnd),
    getActivities(sb, IMPORT_START_LOCAL, today),
  ]);
  return { sessions, activities, phases, races, deloads, ftp: settings.ftp_w, weightKg: settings.weight_kg, today };
}

export interface StoredWeekly {
  week_start: string;
  data: WeeklyReportData;
  created_at: string;
}
export interface StoredPhase {
  phase_id: string;
  data: PhaseReportData;
  created_at: string;
}

export async function listReports(sb: SupabaseClient) {
  const [w, p] = await Promise.all([
    sb.from("weekly_reports").select("week_start, data, created_at").order("week_start", { ascending: false }).range(0, 999),
    sb.from("phase_reports").select("phase_id, data, created_at").order("created_at", { ascending: false }),
  ]);
  if (isMissingSchema(w.error) || isMissingSchema(p.error)) return { missingSchema: true as const, weekly: [], phase: [] };
  if (w.error) throw new Error(`Berichte lesen: ${w.error.message}`);
  if (p.error) throw new Error(`Berichte lesen: ${p.error.message}`);
  return { missingSchema: false as const, weekly: (w.data ?? []) as StoredWeekly[], phase: (p.data ?? []) as StoredPhase[] };
}

export async function getWeeklyReport(sb: SupabaseClient, weekStart: string): Promise<StoredWeekly | null> {
  const { data, error } = await sb.from("weekly_reports").select("week_start, data, created_at").eq("week_start", weekStart).maybeSingle();
  if (isMissingSchema(error)) return null;
  if (error) throw new Error(error.message);
  return data as StoredWeekly | null;
}

export async function getPhaseReport(sb: SupabaseClient, phaseId: string): Promise<StoredPhase | null> {
  const { data, error } = await sb.from("phase_reports").select("phase_id, data, created_at").eq("phase_id", phaseId).maybeSingle();
  if (isMissingSchema(error)) return null;
  if (error) throw new Error(error.message);
  return data as StoredPhase | null;
}

export async function saveWeekly(sb: SupabaseClient, ctx: ReportContext, weekStart: string) {
  const data = buildWeeklyReport(ctx, weekStart);
  const { error } = await sb
    .from("weekly_reports")
    .upsert({ week_start: weekStart, data, updated_at: new Date().toISOString() }, { onConflict: "week_start" });
  if (error) throw new Error(isMissingSchema(error) ? REPORTS_MIGRATION_HINT : `Bericht speichern: ${error.message}`);
  return data;
}

export async function savePhase(sb: SupabaseClient, ctx: ReportContext, phaseId: string) {
  const data = buildPhaseReport(ctx, phaseId);
  const { error } = await sb
    .from("phase_reports")
    .upsert({ phase_id: phaseId, data, updated_at: new Date().toISOString() }, { onConflict: "phase_id" });
  if (error) throw new Error(isMissingSchema(error) ? REPORTS_MIGRATION_HINT : `Bericht speichern: ${error.message}`);
  return data;
}

/**
 * Erstellt alle fälligen, noch fehlenden Berichte:
 * - Wochenreview für jede abgeschlossene Woche ab Planstart
 * - Phasenbericht für jede abgeschlossene Phase
 * Bestehende Berichte bleiben unverändert (Archiv).
 */
export async function generateDueReports(sb: SupabaseClient, today: string) {
  const existing = await listReports(sb);
  if (existing.missingSchema) return { weeks: 0, phases: 0, message: REPORTS_MIGRATION_HINT };
  const ctx = await loadReportContext(sb, today);
  const planStart = ctx.phases[0]?.start_date;
  if (!planStart) return { weeks: 0, phases: 0, message: "Kein Plan vorhanden." };

  const haveWeeks = new Set(existing.weekly.map((w) => w.week_start));
  const havePhases = new Set(existing.phase.map((p) => p.phase_id));
  let weeks = 0;
  let phases = 0;
  for (const w of dueWeeks(planStart, today)) {
    if (haveWeeks.has(w)) continue;
    await saveWeekly(sb, ctx, w);
    weeks++;
  }
  for (const p of duePhases(ctx.phases, today)) {
    if (havePhases.has(p.id)) continue;
    await savePhase(sb, ctx, p.id);
    phases++;
  }
  const parts = [weeks ? `${weeks} Wochenreview${weeks > 1 ? "s" : ""}` : null, phases ? `${phases} Phasenbericht${phases > 1 ? "e" : ""}` : null].filter(Boolean);
  return { weeks, phases, message: parts.length ? `${parts.join(" und ")} erstellt.` : "Alle Berichte sind aktuell." };
}
