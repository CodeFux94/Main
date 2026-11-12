-- Enduro One 2027 – Grundschema (Etappe 1: Plan + Kalender)
-- Ausführen im Supabase Dashboard → SQL Editor (oder per `supabase db push`).

-- ---------------------------------------------------------------------------
-- Einstellungen (genau eine Zeile, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id          smallint primary key default 1 check (id = 1),
  ftp_w       integer not null default 136 check (ftp_w > 0),
  weight_kg   numeric(5,1) not null default 82 check (weight_kg > 0),
  -- Untergrenzen der HF-Zonen in bpm (Z1 = alles darunter)
  hr_z2       integer not null default 127,
  hr_z3       integer not null default 158,
  hr_z4       integer not null default 174,
  hr_z5       integer not null default 189,
  timezone    text not null default 'Europe/Berlin',
  -- geheimer Token für den ICS-Feed (/api/ics/<token>)
  ics_token   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at  timestamptz not null default now(),
  constraint hr_zones_ascending check (hr_z2 < hr_z3 and hr_z3 < hr_z4 and hr_z4 < hr_z5)
);

-- ---------------------------------------------------------------------------
-- Rennen
-- ---------------------------------------------------------------------------
create table if not exists public.races (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  start_date  date not null,
  end_date    date not null,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Phasen
-- ---------------------------------------------------------------------------
create table if not exists public.phases (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null check (kind in ('training','pause','taper','race','recovery')),
  start_date  date not null,
  end_date    date not null,
  color       text not null default '#38bdf8',
  focus       text,
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Entlastungswochen
-- ---------------------------------------------------------------------------
create table if not exists public.deload_weeks (
  id             uuid primary key default gen_random_uuid(),
  start_date     date not null,
  end_date       date not null,
  volume_factor  numeric(3,2) not null default 0.6 check (volume_factor > 0 and volume_factor <= 1),
  check (end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Standardwoche (Vorlage)
-- ---------------------------------------------------------------------------
create table if not exists public.week_template (
  id            uuid primary key default gen_random_uuid(),
  weekday       smallint not null check (weekday between 1 and 7), -- 1 = Mo … 7 = So
  session_type  text not null check (session_type in ('strength','intervals','mobility','enduro','gravel')),
  title         text not null,
  start_time    time not null,
  duration_min  integer not null check (duration_min > 0),
  duration_max  integer not null,
  check (duration_max >= duration_min),
  unique (weekday, session_type)
);

-- ---------------------------------------------------------------------------
-- Manuelle Änderungen am Plan (absagen / verschieben)
-- slot_key = '<Originaldatum>|<Typ>', z. B. '2026-11-22|gravel'
-- ---------------------------------------------------------------------------
create table if not exists public.plan_overrides (
  id          uuid primary key default gen_random_uuid(),
  slot_key    text not null unique,
  action      text not null check (action in ('cancel','move')),
  new_date    date,
  new_time    time,
  note        text,
  created_at  timestamptz not null default now(),
  check (action = 'cancel' or new_date is not null)
);

-- ---------------------------------------------------------------------------
-- Geplante Einheiten (vom Generator erzeugt, siehe lib/plan/generate.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.planned_sessions (
  id             uuid primary key default gen_random_uuid(),
  slot_key       text not null unique,
  original_date  date not null,
  date           date not null,
  start_time     time,
  session_type   text not null check (session_type in ('strength','intervals','mobility','enduro','gravel','race')),
  title          text not null,
  target_min     integer,
  target_max     integer,
  phase_id       uuid references public.phases(id) on delete set null,
  race_id        uuid references public.races(id) on delete set null,
  volume_factor  numeric(3,2) not null default 1,
  cancelled      boolean not null default false,
  note           text,
  -- Strava-Aktivität, die diese Einheit erfüllt (ab Etappe 2)
  activity_id    bigint,
  updated_at     timestamptz not null default now()
);
create index if not exists planned_sessions_date_idx on public.planned_sessions (date);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Es gibt genau einen Nutzer (Registrierung ist im Dashboard deaktiviert).
-- Angemeldete Nutzer dürfen alles, anonyme nichts. Serverseitige Jobs
-- (Cron, Webhook, ICS) nutzen den Secret Key und umgehen RLS.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['settings','races','phases','deload_weeks','week_template','plan_overrides','planned_sessions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

insert into public.settings (id) values (1) on conflict (id) do nothing;
