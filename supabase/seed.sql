-- Ausgangsplan Enduro One 2027 (generiert aus lib/plan/seed-data.ts – nicht von Hand bearbeiten)
-- Ausführen NACH der Migration. Kann gefahrlos mehrfach ausgeführt werden.

update public.settings set ftp_w = 136, weight_kg = 82, hr_z2 = 127, hr_z3 = 158, hr_z4 = 174, hr_z5 = 189 where id = 1;

insert into public.races (id, name, location, start_date, end_date) values
  ('a0000000-0000-4000-8000-000000000001', 'Enduro One Schulenberg', 'Schulenberg (Harz)', '2027-06-25', '2027-06-28'),
  ('a0000000-0000-4000-8000-000000000002', 'Enduro One Roßbach', 'Roßbach', '2027-09-04', '2027-09-05')
on conflict (id) do nothing;

insert into public.phases (id, name, kind, start_date, end_date, color, focus) values
  ('b0000000-0000-4000-8000-000000000001', 'Phase 1 – Einstieg', 'training', '2026-11-16', '2026-12-20', '#38bdf8', 'Gewöhnung, Technik, Grundlage'),
  ('b0000000-0000-4000-8000-000000000002', 'Pause', 'pause', '2026-12-21', '2027-01-03', '#64748b', 'Feiertage, Erholung'),
  ('b0000000-0000-4000-8000-000000000003', 'Phase 2 – Kraft + Grundlage', 'training', '2027-01-04', '2027-02-28', '#22c55e', 'Maximalkraft, Zone-2-Umfang'),
  ('b0000000-0000-4000-8000-000000000004', 'Phase 3 – Power + Intensität', 'training', '2027-03-01', '2027-05-02', '#f59e0b', 'Schwelle, VO2max, Explosivität'),
  ('b0000000-0000-4000-8000-000000000005', 'Phase 4 – Rennspezifisch', 'training', '2027-05-03', '2027-06-13', '#ef4444', 'Renntempo, Abfahrten, Wiederholungen'),
  ('b0000000-0000-4000-8000-000000000006', 'Tapering Schulenberg', 'taper', '2027-06-14', '2027-06-24', '#a855f7', 'Frische aufbauen'),
  ('b0000000-0000-4000-8000-000000000007', 'Rennen Schulenberg', 'race', '2027-06-25', '2027-06-28', '#eab308', 'Enduro One Schulenberg'),
  ('b0000000-0000-4000-8000-000000000008', 'Erholung', 'recovery', '2027-06-29', '2027-07-04', '#64748b', 'Regeneration'),
  ('b0000000-0000-4000-8000-000000000009', 'Phase 5 – Wiederaufbau', 'training', '2027-07-05', '2027-08-01', '#22c55e', 'Grundlage und Kraft auffrischen'),
  ('b0000000-0000-4000-8000-000000000010', 'Phase 6 – Rennspezifisch', 'training', '2027-08-02', '2027-08-22', '#ef4444', 'Renntempo'),
  ('b0000000-0000-4000-8000-000000000011', 'Tapering Roßbach', 'taper', '2027-08-23', '2027-09-03', '#a855f7', 'Frische aufbauen'),
  ('b0000000-0000-4000-8000-000000000012', 'Rennen Roßbach', 'race', '2027-09-04', '2027-09-05', '#eab308', 'Enduro One Roßbach')
on conflict (id) do nothing;

insert into public.deload_weeks (id, start_date, end_date, volume_factor) values
  ('c0000000-0000-4000-8000-000000000001', '2027-01-25', '2027-01-31', 0.6),
  ('c0000000-0000-4000-8000-000000000002', '2027-02-22', '2027-02-28', 0.6),
  ('c0000000-0000-4000-8000-000000000003', '2027-03-22', '2027-03-28', 0.6),
  ('c0000000-0000-4000-8000-000000000004', '2027-04-26', '2027-05-02', 0.6),
  ('c0000000-0000-4000-8000-000000000005', '2027-05-24', '2027-05-30', 0.6),
  ('c0000000-0000-4000-8000-000000000006', '2027-07-26', '2027-08-01', 0.6)
on conflict (id) do nothing;

insert into public.week_template (id, weekday, session_type, title, start_time, duration_min, duration_max) values
  ('d0000000-0000-4000-8000-000000000001', 2, 'strength', 'Kraft A', '18:00', 45, 60),
  ('d0000000-0000-4000-8000-000000000002', 3, 'intervals', 'Intervalle', '18:00', 60, 75),
  ('d0000000-0000-4000-8000-000000000003', 4, 'strength', 'Kraft B', '18:00', 60, 60),
  ('d0000000-0000-4000-8000-000000000004', 5, 'mobility', 'Yoga & Mobility', '18:00', 20, 30),
  ('d0000000-0000-4000-8000-000000000005', 6, 'enduro', 'Enduro', '10:00', 150, 240),
  ('d0000000-0000-4000-8000-000000000006', 7, 'gravel', 'Gravel Zone 2', '10:00', 90, 150)
on conflict do nothing;

insert into public.plan_overrides (slot_key, action, new_date, new_time, note) values
  ('2026-11-22|gravel', 'cancel', null, null, 'Gravel entfällt'),
  ('2027-06-05|enduro', 'move', '2027-06-06', '10:00', 'Enduro auf Sonntag verschoben'),
  ('2027-06-06|gravel', 'cancel', null, null, 'Entfällt wegen Enduro am Sonntag')
on conflict (slot_key) do nothing;
