import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Statusprüfung: /api/health
 * Zeigt nur, OB Variablen gesetzt sind und ob die Datenbank erreichbar ist –
 * niemals die Werte selbst.
 */
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
    ALLOWED_EMAIL: Boolean(process.env.ALLOWED_EMAIL),
  };

  let database: string;
  let plan: string = "unbekannt";
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
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
  return Response.json({ ok, env, database, plan }, { status: ok ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}
