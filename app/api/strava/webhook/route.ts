import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stravaEnv } from "@/lib/strava/client";
import { processOpenEvents } from "@/lib/strava/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Bestätigung des Webhook-Abos durch Strava (hub.challenge). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const { verifyToken } = stravaEnv();
  if (p.get("hub.mode") === "subscribe" && verifyToken && p.get("hub.verify_token") === verifyToken) {
    return NextResponse.json({ "hub.challenge": p.get("hub.challenge") });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

/**
 * Ereignisse von Strava (neue/geänderte/gelöschte Aktivitäten).
 * Strava erwartet innerhalb von 2 s ein 200 – deshalb wird nur gespeichert
 * und die Verarbeitung im Hintergrund erledigt. Inhalte werden nie blind
 * übernommen, sondern immer direkt bei Strava abgerufen.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const objectId = Number(body.object_id);
  const objectType = String(body.object_type ?? "");
  const aspect = String(body.aspect_type ?? "");
  if (!Number.isFinite(objectId) || !["activity", "athlete"].includes(objectType) || !["create", "update", "delete"].includes(aspect)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("webhook_events").insert({
    object_type: objectType,
    object_id: objectId,
    aspect_type: aspect,
    owner_id: Number.isFinite(Number(body.owner_id)) ? Number(body.owner_id) : null,
    updates: (body.updates as object) ?? null,
    event_time: typeof body.event_time === "number" ? new Date(body.event_time * 1000).toISOString() : null,
  });
  if (error) console.error("Webhook speichern:", error.message);

  after(async () => {
    try {
      await processOpenEvents(admin, Date.now() + 45_000);
    } catch (e) {
      console.error("Webhook verarbeiten:", e);
    }
  });
  return NextResponse.json({ ok: true });
}
