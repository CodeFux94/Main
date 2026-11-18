import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/strava/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Täglicher Job (Vercel Cron, siehe vercel.json):
 * Strava-Import fortsetzen, verpasste Webhooks nachholen, HF-Zonen nachladen,
 * Zuordnung aktualisieren. Vercel sendet automatisch
 * "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: conn } = await admin.from("strava_connection").select("id").eq("id", 1).maybeSingle();
  if (!conn) return NextResponse.json({ ok: true, strava: "nicht verbunden" });
  try {
    const result = await runSync(admin, 50_000);
    return NextResponse.json({ ok: result.ok, strava: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
