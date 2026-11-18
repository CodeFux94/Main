import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCode } from "@/lib/strava/client";
import { runSync } from "@/lib/strava/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rücksprung von Strava nach der Freigabe. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const back = (status: string) => NextResponse.redirect(new URL(`/einstellungen?strava=${status}`, req.url));
  const state = p.get("state") ?? "";
  const admin = createAdminClient();

  // state prüfen und verbrauchen (max. 15 Minuten alt)
  const { data: st } = await admin.from("strava_oauth_states").select("state, created_at").eq("state", state).maybeSingle();
  await admin.from("strava_oauth_states").delete().eq("state", state);
  if (!state || !st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) return back("ungueltig");

  if (p.get("error")) return back("abgebrochen");
  const scope = p.get("scope") ?? "";
  if (!scope.includes("activity:read")) return back("rechte-fehlen");
  const code = p.get("code");
  if (!code) return back("fehler");

  try {
    const t = await exchangeCode(code);
    if (!t.athlete?.id) return back("fehler");
    const { data: existing } = await admin.from("strava_connection").select("athlete_id").eq("id", 1).maybeSingle();
    const sameAthlete = existing && Number(existing.athlete_id) === t.athlete.id;
    if (existing && !sameAthlete) {
      // anderes Strava-Konto: alte Daten verwerfen
      await admin.from("planned_sessions").update({ activity_id: null }).not("activity_id", "is", null);
      await admin.from("activities").delete().gte("id", 0);
    }
    const row = {
      id: 1,
      athlete_id: t.athlete.id,
      athlete_name: [t.athlete.firstname, t.athlete.lastname].filter(Boolean).join(" ") || null,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(),
      scope,
      connected_at: new Date().toISOString(),
      rate_limited_until: null,
      ...(sameAthlete ? {} : { import_page: 1, import_done: false, last_sync_at: null, last_sync_result: null }),
    };
    const { error } = await admin.from("strava_connection").upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("Strava-Callback:", e);
    return back("fehler");
  }

  // Erstimport im Hintergrund starten
  after(async () => {
    try {
      await runSync(admin, 50_000);
    } catch (e) {
      console.error("Strava-Erstimport:", e);
    }
  });
  return back("verbunden");
}
