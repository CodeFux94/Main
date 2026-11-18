-- Enduro One 2027 – Einheiten ändern (Art, Titel, Dauer) + neuer Typ "Ausdauer (Studio/Lauf)"
-- Ausführen im Supabase Dashboard → SQL Editor (nach 0003_reports.sql).
-- Kann gefahrlos mehrfach ausgeführt werden.

alter table public.plan_overrides add column if not exists new_session_type text;
alter table public.plan_overrides add column if not exists new_title text;
alter table public.plan_overrides add column if not exists new_duration_min integer;
alter table public.plan_overrides add column if not exists new_duration_max integer;

alter table public.plan_overrides drop constraint if exists plan_overrides_new_session_type_check;
alter table public.plan_overrides add constraint plan_overrides_new_session_type_check
  check (new_session_type is null or new_session_type in ('strength','intervals','mobility','enduro','gravel','cardio'));
alter table public.plan_overrides drop constraint if exists plan_overrides_new_duration_check;
alter table public.plan_overrides add constraint plan_overrides_new_duration_check
  check ((new_duration_min is null or new_duration_min > 0) and (new_duration_max is null or new_duration_max > 0));

-- neuen Typ "cardio" zulassen
alter table public.planned_sessions drop constraint if exists planned_sessions_session_type_check;
alter table public.planned_sessions add constraint planned_sessions_session_type_check
  check (session_type in ('strength','intervals','mobility','enduro','gravel','cardio','race'));
alter table public.week_template drop constraint if exists week_template_session_type_check;
alter table public.week_template add constraint week_template_session_type_check
  check (session_type in ('strength','intervals','mobility','enduro','gravel','cardio'));
