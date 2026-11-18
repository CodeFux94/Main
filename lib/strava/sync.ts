import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { matchActivities, type MatchActivity, type MatchSession } from "@/lib/plan/matching";
import {
  RateLimitError, StravaAuthError, StravaClient, StravaNotConnectedError, StravaNotFoundError, loadConnection,
} from "./client";
import { importAfterEpoch } from "./limits";
import { buildHrHistogram, mapActivity, type StravaActivity } from "./mapping";

const PER_PAGE = 100;

export interface SyncResult {
  ok: boolean;
  message: string;
  imported: number;
  zonesLoaded: number;
  pendingZones: number;
  importDone: boolean;
  rateLimited: boolean;
  matched: number;
}

// ---------------------------------------------------------------- Speichern

export async function upsertActivities(admin: SupabaseClient, list: StravaActivity[]) {
  if (list.length === 0) return;
  const rows = list.map((a) => mapActivity(a));
  const { error } = await admin.from("activities").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`Aktivitäten speichern: ${error.message}`);
}

async function recomputeZones(sb: SupabaseClient, id?: number) {
  const { error } = await sb.rpc("recompute_activity_zones", id ? { p_id: id } : {});
  if (error) throw new Error(`Zonen berechnen: ${error.message}`);
}

/** Lädt den HF-Verlauf einer Aktivität und speichert das Histogramm. */
async function loadZones(client: StravaClient, admin: SupabaseClient, id: number): Promise<"done" | "none" | "error"> {
  let status: "done" | "none" | "error" = "none";
  let hist: Record<string, number> | null = null;
  try {
    const streams = await client.get<Record<string, { data: number[] }>>(`/activities/${id}/streams`, {
      keys: "time,heartrate",
      key_by_type: "true",
    });
    if (streams.heartrate?.data?.length && streams.time?.data?.length) {
      hist = buildHrHistogram(streams.time.data, streams.heartrate.data);
      status = Object.keys(hist).length ? "done" : "none";
    }
  } catch (e) {
    if (e instanceof RateLimitError || e instanceof StravaAuthError) throw e;
    status = e instanceof StravaNotFoundError ? "none" : "error";
  }
  const { error } = await admin
    .from("activities")
    .update({ hr_histogram: status === "done" ? hist : null, zones_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`HF-Daten speichern: ${error.message}`);
  return status;
}

/** Arbeitet offene HF-Zonen ab (neueste zuerst), bis die Zeit um ist. */
async function processZoneQueue(client: StravaClient, admin: SupabaseClient, deadline: number) {
  const { data, error } = await admin
    .from("activities")
    .select("id, has_heartrate")
    .eq("zones_status", "pending")
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Zonen-Warteschlange: ${error.message}`);
  const queue = data ?? [];

  // Ohne HF-Sensor: keine Anfrage nötig
  const noHr = queue.filter((a) => !a.has_heartrate).map((a) => a.id);
  if (noHr.length) {
    const { error: e2 } = await admin.from("activities").update({ zones_status: "none" }).in("id", noHr);
    if (e2) throw new Error(`Zonen-Status: ${e2.message}`);
  }
  let loaded = 0;
  try {
    for (const a of queue.filter((x) => x.has_heartrate)) {
      if (Date.now() > deadline) break;
      await loadZones(client, admin, Number(a.id));
      loaded++;
    }
  } finally {
    if (loaded || noHr.length) await recomputeZones(admin);
  }
  return loaded;
}

async function countPendingZones(admin: SupabaseClient) {
  const { count } = await admin
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("zones_status", "pending")
    .is("deleted_at", null);
  return count ?? 0;
}

// ---------------------------------------------------------------- Zuordnung

/**
 * Ordnet alle Aktivitäten den geplanten Einheiten neu zu und speichert
 * nur die geänderten Einheiten. Funktioniert mit Nutzer- oder Admin-Client.
 */
export async function rematch(sb: SupabaseClient): Promise<number> {
  const { data: sessions, error } = await sb
    .from("planned_sessions")
    .select("id, date, session_type, cancelled, activity_id")
    .range(0, 4999);
  if (error) throw new Error(`Einheiten lesen: ${error.message}`);
  if (!sessions?.length) return 0;

  const from = addDays(sessions.reduce((m, s) => (s.date < m ? s.date : m), sessions[0].date), -3);
  const { data: acts, error: e2 } = await sb
    .from("activities")
    .select("id, local_date, start_date_local, sport_type, moving_time_s, zone_seconds")
    .is("deleted_at", null)
    .gte("local_date", from)
    .range(0, 9999);
  if (e2) throw new Error(`Aktivitäten lesen: ${e2.message}`);

  const matches = matchActivities(
    sessions as MatchSession[],
    (acts ?? []).map((a) => ({ ...a, id: Number(a.id) })) as MatchActivity[],
  );
  const changed = sessions.filter((s) => (s.activity_id == null ? null : Number(s.activity_id)) !== (matches.get(s.id) ?? null));
  for (let i = 0; i < changed.length; i += 10) {
    await Promise.all(
      changed.slice(i, i + 10).map(async (s) => {
        const { error: e3 } = await sb
          .from("planned_sessions")
          .update({ activity_id: matches.get(s.id) ?? null })
          .eq("id", s.id);
        if (e3) throw new Error(`Zuordnung speichern: ${e3.message}`);
      }),
    );
  }
  return changed.length;
}

// ---------------------------------------------------------------- Webhook

export interface WebhookEventRow {
  id: number;
  object_type: string;
  object_id: number;
  aspect_type: string;
  owner_id: number | null;
  updates: Record<string, string> | null;
}

async function handleEvent(admin: SupabaseClient, ev: WebhookEventRow, getClient: () => Promise<StravaClient>) {
  const conn = await loadConnection(admin);
  if (!conn) return "ignoriert (nicht verbunden)";
  if (ev.owner_id != null && Number(ev.owner_id) !== conn.athlete_id) return "ignoriert (anderer Athlet)";

  if (ev.object_type === "athlete") {
    if (ev.updates?.authorized === "false") {
      await admin.from("strava_connection").delete().eq("id", 1);
      return "Zugriff in Strava widerrufen – Verbindung entfernt";
    }
    return "ignoriert";
  }
  if (ev.object_type !== "activity") return "ignoriert";

  if (ev.aspect_type === "delete") {
    await admin.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", ev.object_id);
    return "gelöscht";
  }

  const client = await getClient();
  try {
    const a = await client.get<StravaActivity>(`/activities/${ev.object_id}`);
    await upsertActivities(admin, [a]);
  } catch (e) {
    if (e instanceof StravaNotFoundError) {
      // privat geworden oder gelöscht
      await admin.from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", ev.object_id);
      return "nicht mehr verfügbar";
    }
    throw e;
  }
  const { data: row } = await admin.from("activities").select("zones_status, has_heartrate").eq("id", ev.object_id).single();
  if (row?.zones_status === "pending") {
    if (row.has_heartrate) await loadZones(client, admin, ev.object_id);
    else await admin.from("activities").update({ zones_status: "none" }).eq("id", ev.object_id);
    await recomputeZones(admin, ev.object_id);
  }
  return ev.aspect_type === "create" ? "importiert" : "aktualisiert";
}

/** Verarbeitet offene Webhook-Ereignisse (älteste zuerst). */
export async function processOpenEvents(admin: SupabaseClient, deadline = Date.now() + 20_000, client?: StravaClient) {
  const { data, error } = await admin
    .from("webhook_events")
    .select("id, object_type, object_id, aspect_type, owner_id, updates")
    .is("processed_at", null)
    .order("received_at")
    .limit(50);
  if (error) throw new Error(`Webhook-Ereignisse: ${error.message}`);
  let c = client;
  const getClient = async () => (c ??= await StravaClient.create(admin));
  let done = 0;
  for (const ev of (data ?? []) as WebhookEventRow[]) {
    if (Date.now() > deadline) break;
    let result: string;
    let err: string | null = null;
    try {
      result = await handleEvent(admin, { ...ev, object_id: Number(ev.object_id) }, getClient);
    } catch (e) {
      if (e instanceof RateLimitError) break; // später erneut
      result = "Fehler";
      err = (e as Error).message;
    }
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: err ?? (result.startsWith("ignoriert") ? result : null) })
      .eq("id", ev.id);
    done++;
  }
  if (done) await rematch(admin);
  if (c) await c.saveStatus({});
  return done;
}

// ---------------------------------------------------------------- Synchronisation

/**
 * Ein Synchronisationslauf (Button, Cron oder nach dem Verbinden):
 * 1. Erstimport ab 01.06.2026 seitenweise fortsetzen – danach nur die letzten Tage
 * 2. HF-Zonen nachladen
 * 3. offene Webhook-Ereignisse abarbeiten
 * 4. Aktivitäten den Einheiten zuordnen
 * Hält ein Zeitbudget ein und stoppt vor dem Rate-Limit. Der Fortschritt wird
 * gespeichert, der nächste Lauf macht dort weiter.
 */
export async function runSync(admin: SupabaseClient, budgetMs = 45_000): Promise<SyncResult> {
  const deadline = Date.now() + budgetMs;
  const result: SyncResult = {
    ok: true, message: "", imported: 0, zonesLoaded: 0, pendingZones: 0, importDone: false, rateLimited: false, matched: 0,
  };
  let client: StravaClient;
  try {
    client = await StravaClient.create(admin);
  } catch (e) {
    if (e instanceof RateLimitError || e instanceof StravaNotConnectedError) {
      return { ...result, ok: e instanceof RateLimitError, rateLimited: e instanceof RateLimitError, message: e.message };
    }
    throw e;
  }

  result.importDone = client.conn.import_done;
  try {
    if (!client.conn.import_done) {
      let page = client.conn.import_page;
      while (Date.now() < deadline) {
        const list = await client.get<StravaActivity[]>("/athlete/activities", { after: importAfterEpoch(), per_page: PER_PAGE, page });
        await upsertActivities(admin, list);
        result.imported += list.length;
        if (list.length < PER_PAGE) {
          result.importDone = true;
          await client.saveStatus({ import_done: true, import_page: page });
          break;
        }
        page++;
        await client.saveStatus({ import_page: page });
      }
    } else {
      // Laufende Aktualisierung: alles ab 3 Tage vor der neuesten Aktivität
      const { data: latest } = await admin
        .from("activities")
        .select("start_date")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      const after = Math.max(importAfterEpoch(), latest ? Math.floor(new Date(latest.start_date).getTime() / 1000) - 3 * 86400 : 0);
      for (let page = 1; Date.now() < deadline; page++) {
        const list = await client.get<StravaActivity[]>("/athlete/activities", { after, per_page: PER_PAGE, page });
        await upsertActivities(admin, list);
        result.imported += list.length;
        if (list.length < PER_PAGE) break;
      }
    }
    result.zonesLoaded = await processZoneQueue(client, admin, deadline);
    await processOpenEvents(admin, deadline, client);
  } catch (e) {
    if (e instanceof RateLimitError) {
      result.rateLimited = true;
    } else {
      result.ok = false;
      result.message = (e as Error).message;
    }
  }

  result.matched = await rematch(admin);
  result.pendingZones = await countPendingZones(admin);
  if (!result.message) {
    const parts = [
      `${result.imported} Aktivitäten geladen`,
      result.zonesLoaded ? `${result.zonesLoaded} × HF-Zonen` : null,
      result.pendingZones ? `${result.pendingZones} HF-Zonen ausstehend` : null,
      !result.importDone ? "Erstimport läuft noch" : null,
      result.rateLimited ? "Rate-Limit erreicht – Rest folgt automatisch" : null,
    ].filter(Boolean);
    result.message = parts.join(" · ");
  }
  await client.saveStatus({ last_sync_at: new Date().toISOString(), last_sync_result: result.message });
  return result;
}
