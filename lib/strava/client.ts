import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatUsage, nearLimit, nextWindow, parseRateLimit, type RateLimit } from "./limits";

// Basis-URLs (für lokale Tests per Umgebungsvariable überschreibbar)
const API_BASE = () => process.env.STRAVA_API_BASE ?? "https://www.strava.com/api/v3";
const OAUTH_BASE = () => process.env.STRAVA_OAUTH_BASE ?? "https://www.strava.com";

export const STRAVA_SCOPE = "read,activity:read_all";

export class RateLimitError extends Error {
  constructor(public until: Date, message = "Strava-Rate-Limit erreicht") {
    super(message);
  }
}
export class StravaAuthError extends Error {}
export class StravaNotConnectedError extends Error {}

export function stravaEnv() {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim();
  return { clientId, clientSecret, verifyToken, configured: Boolean(clientId && clientSecret) };
}

function requireEnv() {
  const env = stravaEnv();
  if (!env.clientId || !env.clientSecret) {
    throw new Error("STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET fehlen in den Umgebungsvariablen.");
  }
  return env as { clientId: string; clientSecret: string; verifyToken?: string };
}

export function authorizeUrl(redirectUri: string, state: string) {
  const { clientId } = requireEnv();
  const u = new URL(`${OAUTH_BASE()}/oauth/authorize`);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("scope", STRAVA_SCOPE);
  u.searchParams.set("state", state);
  return u.toString();
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireEnv();
  const res = await fetch(`${OAUTH_BASE()}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
    cache: "no-store",
  });
  if (!res.ok) throw new StravaAuthError(`Strava-Token-Anfrage fehlgeschlagen (${res.status}): ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) => tokenRequest({ code, grant_type: "authorization_code" });
const refreshAccessToken = (refresh: string) => tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });

export async function deauthorize(accessToken: string) {
  await fetch(`${OAUTH_BASE()}/oauth/deauthorize`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => {});
}

export interface StravaConnection {
  athlete_id: number;
  athlete_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  import_page: number;
  import_done: boolean;
  last_sync_at: string | null;
  last_sync_result: string | null;
  rate_limited_until: string | null;
  rate_usage: string | null;
  connected_at: string;
}

export async function loadConnection(admin: SupabaseClient): Promise<StravaConnection | null> {
  const { data, error } = await admin.from("strava_connection").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Strava-Verbindung lesen: ${error.message}`);
  return data ? { ...(data as StravaConnection), athlete_id: Number(data.athlete_id) } : null;
}

/**
 * Strava-API-Client mit automatischem Token-Refresh und Rate-Limit-Schutz.
 * Bricht mit RateLimitError ab, bevor das Limit erreicht ist.
 */
export class StravaClient {
  requests = 0;
  rate: RateLimit | null = null;

  constructor(private admin: SupabaseClient, public conn: StravaConnection) {}

  static async create(admin: SupabaseClient) {
    const conn = await loadConnection(admin);
    if (!conn) throw new StravaNotConnectedError("Strava ist nicht verbunden.");
    if (conn.rate_limited_until && new Date(conn.rate_limited_until) > new Date()) {
      throw new RateLimitError(new Date(conn.rate_limited_until), "Strava-Rate-Limit aktiv – später erneut versuchen");
    }
    return new StravaClient(admin, conn);
  }

  private async token(): Promise<string> {
    // 5 Minuten Puffer vor Ablauf
    if (new Date(this.conn.expires_at).getTime() - Date.now() > 5 * 60_000) return this.conn.access_token;
    const t = await refreshAccessToken(this.conn.refresh_token);
    const expires_at = new Date(t.expires_at * 1000).toISOString();
    const { error } = await this.admin
      .from("strava_connection")
      .update({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at })
      .eq("id", 1);
    if (error) throw new Error(`Token speichern: ${error.message}`);
    this.conn = { ...this.conn, access_token: t.access_token, refresh_token: t.refresh_token, expires_at };
    return t.access_token;
  }

  async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    if (nearLimit(this.rate)) throw new RateLimitError(nextWindow(), "Rate-Limit fast erreicht – Rest folgt später");
    const url = new URL(`${API_BASE()}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    let res = await fetch(url, { headers: { authorization: `Bearer ${await this.token()}` }, cache: "no-store" });
    this.requests++;
    if (res.status === 401) {
      // Token evtl. widerrufen/abgelaufen → einmal erneuern und wiederholen
      this.conn = { ...this.conn, expires_at: new Date(0).toISOString() };
      res = await fetch(url, { headers: { authorization: `Bearer ${await this.token()}` }, cache: "no-store" });
      this.requests++;
    }
    this.rate = parseRateLimit(res.headers) ?? this.rate;
    if (res.status === 429) {
      const daily = this.rate && this.rate.usageDay >= this.rate.limitDay;
      const until = daily ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)) : nextWindow();
      await this.admin.from("strava_connection").update({ rate_limited_until: until.toISOString() }).eq("id", 1);
      throw new RateLimitError(until);
    }
    if (res.status === 401) throw new StravaAuthError("Strava hat den Zugriff verweigert – bitte neu verbinden.");
    if (res.status === 404) throw new StravaNotFoundError(path);
    if (!res.ok) throw new Error(`Strava ${path}: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  /** Speichert Rate-Limit-Stand und Ergebnis der Synchronisation. */
  async saveStatus(fields: Record<string, unknown>) {
    await this.admin
      .from("strava_connection")
      .update({ rate_usage: formatUsage(this.rate) ?? this.conn.rate_usage, ...fields })
      .eq("id", 1);
  }
}

export class StravaNotFoundError extends Error {}

// ---------------------------------------------------------------- Webhook-Abo

async function subscriptionRequest(method: "GET" | "POST" | "DELETE", body?: Record<string, string>, id?: number) {
  const { clientId, clientSecret } = requireEnv();
  const base = `${API_BASE()}/push_subscriptions${id ? `/${id}` : ""}`;
  const auth = { client_id: clientId, client_secret: clientSecret };
  const res =
    method === "GET" || method === "DELETE"
      ? await fetch(`${base}?${new URLSearchParams(auth)}`, { method, cache: "no-store" })
      : await fetch(base, {
          method,
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ ...auth, ...body }),
          cache: "no-store",
        });
  const text = await res.text();
  if (!res.ok) throw new Error(`Strava-Webhook (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

export interface WebhookSubscription {
  id: number;
  callback_url: string;
}

export async function listSubscriptions(): Promise<WebhookSubscription[]> {
  return (await subscriptionRequest("GET")) ?? [];
}

export async function createSubscription(callbackUrl: string) {
  const { verifyToken } = requireEnv();
  if (!verifyToken) throw new Error("STRAVA_WEBHOOK_VERIFY_TOKEN fehlt in den Umgebungsvariablen.");
  return subscriptionRequest("POST", { callback_url: callbackUrl, verify_token: verifyToken }) as Promise<WebhookSubscription>;
}

export const deleteSubscription = (id: number) => subscriptionRequest("DELETE", undefined, id);
