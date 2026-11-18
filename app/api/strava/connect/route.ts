import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { authorizeUrl, stravaEnv } from "@/lib/strava/client";

export const dynamic = "force-dynamic";

/** Startet die Verbindung mit Strava (nur für angemeldete Nutzer). */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.redirect(new URL("/login", req.url));
  if (!stravaEnv().configured) {
    return NextResponse.redirect(new URL("/einstellungen?strava=nicht-konfiguriert", req.url));
  }

  // Einmal-Token gegen CSRF; liegt in der DB, damit der Rücksprung auch in
  // einem anderen Browser-Fenster (z. B. iOS-App → Safari) funktioniert.
  const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const admin = createAdminClient();
  await admin.from("strava_oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
  const { error } = await admin.from("strava_oauth_states").insert({ state });
  if (error) return NextResponse.redirect(new URL(`/einstellungen?strava=fehler`, req.url));

  const redirectUri = new URL("/api/strava/callback", req.nextUrl.origin).toString();
  return NextResponse.redirect(authorizeUrl(redirectUri, state));
}
