-- Enduro One 2027 – Etappe 5: Berichte
-- Ausführen im Supabase Dashboard → SQL Editor (nach 0002_strava.sql).
-- Kann gefahrlos mehrfach ausgeführt werden.

-- Wochenreviews (eingefroren beim Erstellen; "Neu berechnen" überschreibt)
create table if not exists public.weekly_reports (
  week_start  date primary key,          -- Montag der Berichtswoche
  data        jsonb not null,            -- Kennzahlen, Einheiten, "Was war gut", "Wo steckt Potenzial"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Phasenberichte
create table if not exists public.phase_reports (
  phase_id    uuid primary key references public.phases(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['weekly_reports','phase_reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
