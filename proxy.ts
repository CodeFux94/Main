import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { KEY_VAR_NAMES, resolvePublicSupabase, URL_VAR_NAMES } from "@/lib/env";

// Pfade, die ohne Login erreichbar sein müssen.
const PUBLIC_PREFIXES = ["/login", "/api/health", "/api/ics/", "/api/strava/webhook", "/api/cron/", "/offline"];

/**
 * Läuft vor jeder Seite: erneuert die Supabase-Sitzung (Cookies) und
 * leitet nicht angemeldete Besucher zur Login-Seite um.
 * Die eigentliche Berechtigung prüft zusätzlich die Datenbank (RLS).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  let response = NextResponse.next({ request });
  const { url, key } = resolvePublicSupabase();
  if (!url || !key) {
    const missing = [!url && URL_VAR_NAMES, !key && KEY_VAR_NAMES].filter(Boolean);
    return new NextResponse(
      `Supabase ist nicht konfiguriert. Fehlende Umgebungsvariable(n): ${missing.join(", ")}.\n\n` +
        "In Vercel unter Settings → Environment Variables für Production eintragen und danach " +
        "unter Deployments → ⋯ → Redeploy neu deployen (siehe README, Schritt 5).",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: [
    // Alles außer statischen Dateien, Icons, Manifest und Service Worker
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)",
  ],
};
