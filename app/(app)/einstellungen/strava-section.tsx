import { createAdminClient } from "@/lib/supabase/admin";
import { loadConnection, stravaEnv } from "@/lib/strava/client";
import { IMPORT_START_LOCAL } from "@/lib/strava/limits";
import { formatDate } from "@/lib/dates";
import { ActionButton } from "@/components/action-button";
import { isMissingSchema, MIGRATION_HINT } from "@/lib/db-errors";
import { disableWebhookAction, disconnectStravaAction, enableWebhookAction, syncStravaAction } from "./strava-actions";

const MESSAGES: Record<string, [string, boolean]> = {
  verbunden: ["Strava ist verbunden. Der Import läuft im Hintergrund – das kann einige Minuten dauern.", true],
  abgebrochen: ["Verbindung abgebrochen.", false],
  "rechte-fehlen": ["Bitte bei Strava die Berechtigung „Aktivitäten ansehen“ (auch private) erlauben.", false],
  ungueltig: ["Der Verbindungsversuch ist abgelaufen. Bitte erneut verbinden.", false],
  "nicht-konfiguriert": ["STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET fehlen in Vercel (siehe README).", false],
  fehler: ["Verbindung mit Strava fehlgeschlagen. Bitte erneut versuchen.", false],
};

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export async function StravaSection({ status, webhookUrl }: { status?: string; webhookUrl: string | null }) {
  const admin = createAdminClient();
  const env = stravaEnv();
  // Migration 0002 schon ausgeführt?
  const probe = await admin.from("strava_connection").select("id").limit(1);
  if (isMissingSchema(probe.error)) {
    return (
      <section className="card mb-4">
        <h2 className="mb-2 font-semibold">Strava</h2>
        <p className="text-sm text-amber-400">{MIGRATION_HINT}</p>
        <p className="mt-2 text-xs text-zinc-500">Danach diese Seite neu laden (README, Schritt 9).</p>
      </section>
    );
  }
  const conn = await loadConnection(admin);
  const [{ count: total }, { count: pending }] = await Promise.all([
    admin.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("activities").select("id", { count: "exact", head: true }).eq("zones_status", "pending").is("deleted_at", null),
  ]);
  const msg = status ? MESSAGES[status] : undefined;
  const limited = conn?.rate_limited_until && new Date(conn.rate_limited_until) > new Date();

  return (
    <section className="card mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Strava</h2>
        {conn ? (
          <span className="badge bg-emerald-950 text-emerald-300">verbunden</span>
        ) : (
          <span className="badge bg-zinc-800 text-zinc-400">nicht verbunden</span>
        )}
      </div>
      {msg && <p className={`mb-3 text-sm ${msg[1] ? "text-emerald-400" : "text-red-400"}`}>{msg[0]}</p>}

      {!env.configured ? (
        <p className="text-sm text-zinc-400">
          Trage zuerst <code>STRAVA_CLIENT_ID</code> und <code>STRAVA_CLIENT_SECRET</code> in Vercel ein (README, Etappe 2).
        </p>
      ) : !conn ? (
        <>
          <p className="mb-3 text-sm text-zinc-400">
            Verbinde dein Strava-Konto. Danach werden alle Aktivitäten ab {formatDate(IMPORT_START_LOCAL)} importiert und
            neue automatisch übernommen.
          </p>
          <a href="/api/strava/connect" className="btn inline-flex bg-[#fc4c02] text-white hover:bg-[#e34402]">
            Mit Strava verbinden
          </a>
          <p className="mt-2 text-xs text-zinc-500">
            Tipp: Am einfachsten im normalen Browser (Safari/Chrome) verbinden – die Verbindung gilt danach auch in der
            installierten App.
          </p>
        </>
      ) : (
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-zinc-300">
            <dt className="text-zinc-500">Konto</dt>
            <dd>{conn.athlete_name ?? `Athlet ${conn.athlete_id}`}</dd>
            <dt className="text-zinc-500">Aktivitäten</dt>
            <dd>
              {total ?? 0} seit {formatDate(IMPORT_START_LOCAL)}
              {!conn.import_done && " · Erstimport läuft"}
              {(pending ?? 0) > 0 && ` · ${pending} HF-Auswertungen ausstehend`}
            </dd>
            <dt className="text-zinc-500">Letzter Abgleich</dt>
            <dd>{conn.last_sync_at ? fmtTime(conn.last_sync_at) : "–"}</dd>
            {conn.last_sync_result && (
              <>
                <dt className="text-zinc-500">Ergebnis</dt>
                <dd className="text-zinc-400">{conn.last_sync_result}</dd>
              </>
            )}
            {conn.rate_usage && (
              <>
                <dt className="text-zinc-500">API-Limit</dt>
                <dd className="text-zinc-400">{conn.rate_usage}</dd>
              </>
            )}
            <dt className="text-zinc-500">Webhook</dt>
            <dd className={webhookUrl ? "text-emerald-400" : "text-amber-400"}>
              {webhookUrl ? "aktiv – neue Aktivitäten kommen automatisch" : "nicht aktiv"}
            </dd>
          </dl>
          {limited && (
            <p className="text-xs text-amber-400">
              Strava-Limit erreicht – weiter ab {fmtTime(conn.rate_limited_until!)}. Der tägliche Abgleich holt den Rest
              automatisch.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <ActionButton action={syncStravaAction} label="Jetzt abgleichen" className="btn-primary" />
            {webhookUrl ? (
              <ActionButton action={disableWebhookAction} label="Webhook entfernen" className="btn-ghost" />
            ) : (
              <ActionButton action={enableWebhookAction} label="Webhook aktivieren" className="btn-secondary" />
            )}
            <ActionButton
              action={disconnectStravaAction}
              label="Trennen"
              className="btn-ghost text-red-400"
              confirmText="Strava-Verbindung trennen? Importierte Aktivitäten bleiben erhalten."
            />
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] text-zinc-600">Aktivitätsdaten: Powered by Strava</p>
    </section>
  );
}
