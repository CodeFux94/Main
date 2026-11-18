-- Enduro One 2027 – Etappe 2: Strava-Anbindung
-- Ausführen im Supabase Dashboard → SQL Editor (nach 0001_init.sql).
-- Kann gefahrlos mehrfach ausgeführt werden.

-- ---------------------------------------------------------------------------
-- Strava-Verbindung (genau eine Zeile, id = 1)
-- Enthält die OAuth-Tokens: KEINE RLS-Policy → nur der Server (Secret Key)
-- kann diese Tabelle lesen oder schreiben.
-- ---------------------------------------------------------------------------
create table if not exists public.strava_connection (
  id                   smallint primary key default 1 check (id = 1),
  athlete_id           bigint not null,
  athlete_name         text,
  access_token         text not null,
  refresh_token        text not null,
  expires_at           timestamptz not null,
  scope                text,
  connected_at         timestamptz not null default now(),
  -- Erstimport
  import_page          integer not null default 1,
  import_done          boolean not null default false,
  -- Status der letzten Synchronisation
  last_sync_at         timestamptz,
  last_sync_result     text,
  rate_limited_until   timestamptz,
  -- letzte bekannte Rate-Limit-Nutzung, z. B. '12/100 · 140/1000'
  rate_usage           text
);
alter table public.strava_connection enable row level security;

-- Einmal-Tokens für den OAuth-Ablauf (Schutz gegen CSRF). Nur Server.
create table if not exists public.strava_oauth_states (
  state       text primary key,
  created_at  timestamptz not null default now()
);
alter table public.strava_oauth_states enable row level security;

-- ---------------------------------------------------------------------------
-- Aktivitäten (Cache der Strava-Daten)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id                  bigint primary key,            -- Strava-Aktivitäts-ID
  name                text not null default '',
  sport_type          text not null,
  type                text,
  start_date          timestamptz not null,
  start_date_local    timestamp not null,
  local_date          date not null,
  moving_time_s       integer not null default 0,
  elapsed_time_s      integer not null default 0,
  distance_m          numeric(10,1) not null default 0,
  elevation_gain_m    numeric(8,1) not null default 0,
  avg_hr              numeric(5,1),
  max_hr              numeric(5,1),
  avg_watts           numeric(6,1),
  weighted_avg_watts  numeric(6,1),
  max_watts           numeric(6,1),
  kilojoules          numeric(8,1),
  device_watts        boolean not null default false,
  has_heartrate       boolean not null default false,
  trainer             boolean not null default false,
  manual              boolean not null default false,
  -- Herzfrequenz-Verteilung: { "<bpm>": Sekunden } – Basis für Zonen
  hr_histogram        jsonb,
  -- Sekunden in Z1..Z5 (nach den Zonen in settings)
  zone_seconds        integer[],
  -- 'pending' = HF-Daten noch nicht geladen, 'done', 'none' = keine HF, 'error'
  zones_status        text not null default 'pending' check (zones_status in ('pending','done','none','error')),
  -- Belastung (Edwards-TRIMP); ohne HF geschätzt
  trimp               numeric(7,1),
  trimp_estimated     boolean not null default false,
  raw                 jsonb,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists activities_local_date_idx on public.activities (local_date);
create index if not exists activities_zones_pending_idx on public.activities (zones_status) where zones_status = 'pending';

-- ---------------------------------------------------------------------------
-- Webhook-Ereignisse (Protokoll + Warteschlange)
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id            bigint generated always as identity primary key,
  object_type   text not null,
  object_id     bigint not null,
  aspect_type   text not null,
  owner_id      bigint,
  updates       jsonb,
  event_time    timestamptz,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);
create index if not exists webhook_events_open_idx on public.webhook_events (received_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Zuordnung Einheit ↔ Aktivität
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'planned_sessions_activity_fk'
  ) then
    update public.planned_sessions set activity_id = null
      where activity_id is not null and activity_id not in (select id from public.activities);
    alter table public.planned_sessions
      add constraint planned_sessions_activity_fk
      foreign key (activity_id) references public.activities(id) on delete set null;
  end if;
end $$;
create index if not exists planned_sessions_activity_idx on public.planned_sessions (activity_id);

-- ---------------------------------------------------------------------------
-- HF-Zonen und TRIMP aus dem Histogramm berechnen (alle oder eine Aktivität).
-- Wird nach dem Laden der HF-Daten und nach Änderung der Zonen aufgerufen.
-- TRIMP (Edwards) = Σ Minuten in Zone × Zonenfaktor (1–5).
-- Ohne HF: Schätzung aus der Dauer (Kraft ×2, Yoga ×1, sonst ×2).
-- ---------------------------------------------------------------------------
create or replace function public.recompute_activity_zones(p_id bigint default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  s record;
  n integer;
begin
  select hr_z2, hr_z3, hr_z4, hr_z5 into s from public.settings where id = 1;

  update public.activities a
  set zone_seconds = z.secs,
      trimp = round(((z.secs[1] * 1 + z.secs[2] * 2 + z.secs[3] * 3 + z.secs[4] * 4 + z.secs[5] * 5) / 60.0)::numeric, 1),
      trimp_estimated = false,
      zones_status = 'done',
      updated_at = now()
  from (
    select a2.id,
      array[
        coalesce(sum(h.value::int) filter (where h.key::int <  s.hr_z2), 0),
        coalesce(sum(h.value::int) filter (where h.key::int >= s.hr_z2 and h.key::int < s.hr_z3), 0),
        coalesce(sum(h.value::int) filter (where h.key::int >= s.hr_z3 and h.key::int < s.hr_z4), 0),
        coalesce(sum(h.value::int) filter (where h.key::int >= s.hr_z4 and h.key::int < s.hr_z5), 0),
        coalesce(sum(h.value::int) filter (where h.key::int >= s.hr_z5), 0)
      ]::integer[] as secs
    from public.activities a2
    cross join lateral jsonb_each_text(a2.hr_histogram) h
    where a2.hr_histogram is not null and (p_id is null or a2.id = p_id)
    group by a2.id
  ) z
  where a.id = z.id;
  get diagnostics n = row_count;

  -- Aktivitäten ohne HF-Daten: Belastung aus der Dauer schätzen
  update public.activities
  set zone_seconds = null,
      trimp = round((moving_time_s / 60.0 * case
                when sport_type in ('WeightTraining','Workout','Crossfit') then 2
                when sport_type in ('Yoga','Pilates') then 1
                else 2 end)::numeric, 1),
      trimp_estimated = true,
      updated_at = now()
  where hr_histogram is null and zones_status in ('none','error') and (p_id is null or id = p_id);

  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security: Aktivitäten und Webhook-Protokoll für den Nutzer
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['activities','webhook_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Webhook-Abo (gehört zur Strava-App, nicht zur Verbindung)
-- ---------------------------------------------------------------------------
alter table public.settings add column if not exists strava_webhook_id bigint;
alter table public.settings add column if not exists strava_webhook_url text;
