import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Supabase-Client mit Secret Key – umgeht RLS.
 * NUR für serverseitige Jobs ohne Nutzersitzung (ICS-Feed, Cron, Webhook).
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl(), serverEnv.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
