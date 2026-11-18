import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/strava/sync";
import { generateDueReports } from "@/lib/reports/service";
import { todayISO } from "@/lib/dates";

export function cronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Strava abgleichen (falls verbunden), danach fällige Berichte erstellen. */
export async function runCronJob() {
  const admin = createAdminClient();
  const out: Record<string, unknown> = {};
  try {
    const { data: conn, error } = await admin.from("strava_connection").select("id").eq("id", 1).maybeSingle();
    out.strava = error ? "nicht eingerichtet" : conn ? await runSync(admin, 35_000) : "nicht verbunden";
  } catch (e) {
    out.strava = { ok: false, error: (e as Error).message };
  }
  try {
    out.reports = await generateDueReports(admin, todayISO());
  } catch (e) {
    out.reports = { error: (e as Error).message };
  }
  return out;
}
