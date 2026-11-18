"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSubscription, deauthorize, deleteSubscription, listSubscriptions, loadConnection, stravaEnv,
} from "@/lib/strava/client";
import { runSync } from "@/lib/strava/sync";
import { appOrigin } from "@/lib/origin";
import type { FormResult } from "@/components/action-form";

function refresh() {
  revalidatePath("/", "layout");
}

export async function syncStravaAction(): Promise<FormResult> {
  await requireUser();
  try {
    const r = await runSync(createAdminClient(), 45_000);
    refresh();
    return r.ok ? { ok: r.message || "Synchronisiert." } : { error: r.message };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function disconnectStravaAction(): Promise<FormResult> {
  await requireUser();
  const admin = createAdminClient();
  const conn = await loadConnection(admin);
  if (conn) await deauthorize(conn.access_token);
  const { error } = await admin.from("strava_connection").delete().eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Strava getrennt. Bereits importierte Aktivitäten bleiben erhalten." };
}

/** Richtet das Webhook-Abo bei Strava ein (eins pro Strava-App). */
export async function enableWebhookAction(): Promise<FormResult> {
  const { supabase } = await requireUser();
  const env = stravaEnv();
  if (!env.configured) return { error: "STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET fehlen in Vercel." };
  if (!env.verifyToken) return { error: "STRAVA_WEBHOOK_VERIFY_TOKEN fehlt in Vercel." };
  const callback = `${await appOrigin()}/api/strava/webhook`;
  try {
    let sub = (await listSubscriptions()).find((s) => s.callback_url === callback);
    if (!sub) {
      // Strava erlaubt nur ein Abo pro App → alte Adresse ersetzen
      for (const old of await listSubscriptions()) await deleteSubscription(old.id);
      sub = await createSubscription(callback);
    }
    const { error } = await supabase
      .from("settings")
      .update({ strava_webhook_id: sub.id, strava_webhook_url: callback })
      .eq("id", 1);
    if (error) return { error: error.message };
    refresh();
    return { ok: "Webhook aktiv – neue Aktivitäten kommen jetzt automatisch." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function disableWebhookAction(): Promise<FormResult> {
  const { supabase } = await requireUser();
  try {
    for (const s of await listSubscriptions()) await deleteSubscription(s.id);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await supabase.from("settings").update({ strava_webhook_id: null, strava_webhook_url: null }).eq("id", 1);
  refresh();
  return { ok: "Webhook entfernt." };
}
