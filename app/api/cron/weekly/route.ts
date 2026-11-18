import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized, runCronJob } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Montags-Job (Vercel Cron, siehe vercel.json): erst die neuesten
 * Strava-Daten holen, dann das Wochenreview der Vorwoche und ggf. den
 * Phasenbericht erstellen.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runCronJob()) });
}
