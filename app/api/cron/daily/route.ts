import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, runCronJob } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Täglicher Job (Vercel Cron, siehe vercel.json): Strava-Abgleich
 * (Import fortsetzen, verpasste Webhooks, HF-Zonen) und verpasste Berichte
 * nachholen. Vercel sendet automatisch "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runCronJob()) });
}
