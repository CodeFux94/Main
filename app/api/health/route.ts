import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublicSupabase, resolveSecretKey } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Statusprüfung: /api/health
 * Zeigt nur, OB Variablen gesetzt sind und ob die Datenbank erreichbar ist –
 * niemals die Werte selbst.
 */
export async function GET() {
  const pub = resolvePublicSupabase();
  const env = {
    supabase_url: Boolean(pub.url),
    supabase_publishable_key: Boolean(pub.key),
    supabase_secret_key: Boolean(resolveSecretKey()),
    ALLOWED_EMAIL: Boolean(process.env.ALLOWED_EMAIL),
  };

  let database: string;
  let plan: string = "unbekannt";
  if (!env.supabase_url || !env.supabase_secret_key) {
    database = "nicht geprüft (Variablen fehlen)";
  } else {
    try {
      const sb = createAdminClient();
      const { error } = await sb.from("settings").select("id").eq("id", 1).single();
      if (error) {
        database = `Fehler: ${error.message} – wurden Migration und Seed im SQL Editor ausgeführt?`;
      } else {
        database = "ok";
        const { count: phases } = await sb.from("phases").select("id", { count: "exact", head: true });
        const { count: sessions } = await sb.from("planned_sessions").select("id", { count: "exact", head: true });
        plan = `${phases ?? 0} Phasen, ${sessions ?? 0} Einheiten`;
      }
    } catch (e) {
      database = `Fehler: ${(e as Error).message}`;
    }
  }

  const ok = Object.values(env).every(Boolean) && database === "ok";
  // Projekt-Kennung (Teil der öffentlichen URL), um zu sehen, mit welchem Supabase-Projekt die App spricht
  const project = pub.url ? new URL(pub.url).hostname.split(".")[0] : null;
  return Response.json({ ok, env, project, database, plan }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
