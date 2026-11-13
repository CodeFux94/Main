import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDeloads, getOverrides, getPhases, getRaces, getTemplate, requireUser } from "@/lib/data";
import { formatDate, WEEKDAY_NAMES } from "@/lib/dates";
import { PHASE_KIND_LABELS, PHASE_KINDS, SESSION_TYPE_LABELS } from "@/lib/plan/types";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { deletePlanRowAction, regeneratePlanAction, savePlanRowAction } from "../actions";

export const metadata: Metadata = { title: "Plan bearbeiten" };

const TEMPLATE_TYPES = ["strength", "intervals", "mobility", "enduro", "gravel"] as const;

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

function Row({ table, id, children }: { table: string; id?: string; children: ReactNode }) {
  return (
    <ActionForm
      action={savePlanRowAction}
      submitLabel={id ? "Speichern" : "Hinzufügen"}
      className={`rounded-xl border p-3 ${id ? "border-zinc-800 bg-zinc-950/50" : "border-dashed border-zinc-700"}`}
      extraButtons={
        id ? (
          <ActionButton
            action={deletePlanRowAction.bind(null, table, id)}
            label="Löschen"
            className="btn-ghost py-2 text-red-400"
            confirmText="Wirklich löschen? Der Plan wird danach neu erzeugt."
          />
        ) : undefined
      }
    >
      <input type="hidden" name="_table" value={table} />
      {id && <input type="hidden" name="id" value={id} />}
      {children}
    </ActionForm>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card mb-4">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-zinc-500">{hint}</p>}
      <div className={`space-y-3 ${hint ? "" : "mt-3"}`}>{children}</div>
    </section>
  );
}

export default async function PlanEditPage() {
  const { supabase } = await requireUser();
  const [races, phases, deloads, template, overrides] = await Promise.all([
    getRaces(supabase),
    getPhases(supabase),
    getDeloads(supabase),
    getTemplate(supabase),
    getOverrides(supabase),
  ]);

  const raceFields = (r?: (typeof races)[number]) => (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Name" className="col-span-2"><input name="name" defaultValue={r?.name} className="input" required /></Field>
      <Field label="Ort" className="col-span-2"><input name="location" defaultValue={r?.location ?? ""} className="input" /></Field>
      <Field label="Start"><input type="date" name="start_date" defaultValue={r?.start_date} className="input" required /></Field>
      <Field label="Ende"><input type="date" name="end_date" defaultValue={r?.end_date} className="input" required /></Field>
    </div>
  );

  const phaseFields = (p?: (typeof phases)[number]) => (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Name" className="col-span-2"><input name="name" defaultValue={p?.name} className="input" required /></Field>
      <Field label="Typ">
        <select name="kind" defaultValue={p?.kind ?? "training"} className="input">
          {PHASE_KINDS.map((k) => <option key={k} value={k}>{PHASE_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field label="Farbe"><input type="color" name="color" defaultValue={p?.color ?? "#38bdf8"} className="input h-[46px] p-1" /></Field>
      <Field label="Start"><input type="date" name="start_date" defaultValue={p?.start_date} className="input" required /></Field>
      <Field label="Ende"><input type="date" name="end_date" defaultValue={p?.end_date} className="input" required /></Field>
      <Field label="Fokus" className="col-span-2"><input name="focus" defaultValue={p?.focus ?? ""} className="input" /></Field>
    </div>
  );

  const deloadFields = (d?: (typeof deloads)[number]) => (
    <div className="grid grid-cols-3 gap-2">
      <Field label="Start"><input type="date" name="start_date" defaultValue={d?.start_date} className="input px-2" required /></Field>
      <Field label="Ende"><input type="date" name="end_date" defaultValue={d?.end_date} className="input px-2" required /></Field>
      <Field label="Umfang">
        <input name="volume_factor" inputMode="decimal" defaultValue={String(d?.volume_factor ?? 0.6).replace(".", ",")} className="input" />
      </Field>
    </div>
  );

  const templateFields = (t?: (typeof template)[number]) => (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Wochentag">
        <select name="weekday" defaultValue={t?.weekday ?? 1} className="input">
          {WEEKDAY_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
        </select>
      </Field>
      <Field label="Typ">
        <select name="session_type" defaultValue={t?.session_type ?? "strength"} className="input">
          {TEMPLATE_TYPES.map((k) => <option key={k} value={k}>{SESSION_TYPE_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field label="Titel"><input name="title" defaultValue={t?.title} className="input" required /></Field>
      <Field label="Uhrzeit"><input type="time" name="start_time" defaultValue={t?.start_time ?? "18:00"} className="input" required /></Field>
      <Field label="Dauer min (Minuten)"><input type="number" name="duration_min" defaultValue={t?.duration_min ?? 60} className="input" required /></Field>
      <Field label="Dauer max (Minuten)"><input type="number" name="duration_max" defaultValue={t?.duration_max ?? 60} className="input" required /></Field>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Plan bearbeiten"
        subtitle={<Link href="/einstellungen" className="text-orange-400">← Einstellungen</Link>}
      />
      <div className="card mb-4 text-sm text-zinc-400">
        Jede Änderung erzeugt den Plan automatisch neu. Manuelle Verschiebungen und Absagen aus dem Kalender bleiben
        erhalten.
        <div className="mt-3">
          <ActionButton action={regeneratePlanAction} label="Plan jetzt neu erzeugen" />
        </div>
      </div>

      <Section title="Rennen">
        {races.map((r) => <Row key={r.id} table="races" id={r.id}>{raceFields(r)}</Row>)}
        <details><summary className="cursor-pointer text-sm text-orange-400">+ Rennen hinzufügen</summary><div className="mt-2"><Row table="races">{raceFields()}</Row></div></details>
      </Section>

      <Section title="Phasen" hint="Training = Standardwoche · Tapering = 50 %, keine Kraft in den letzten 7 Tagen · Erholung = Yoga + lockeres Gravel · Pause/Rennen = keine Einheiten.">
        {phases.map((p) => <Row key={p.id} table="phases" id={p.id}>{phaseFields(p)}</Row>)}
        <details><summary className="cursor-pointer text-sm text-orange-400">+ Phase hinzufügen</summary><div className="mt-2"><Row table="phases">{phaseFields()}</Row></div></details>
      </Section>

      <Section title="Entlastungswochen" hint="Umfang als Faktor, z. B. 0,6 = 60 % der Standarddauer. Gilt nur in Trainingsphasen.">
        {deloads.map((d) => <Row key={d.id} table="deload_weeks" id={d.id}>{deloadFields(d)}</Row>)}
        <details><summary className="cursor-pointer text-sm text-orange-400">+ Entlastungswoche hinzufügen</summary><div className="mt-2"><Row table="deload_weeks">{deloadFields()}</Row></div></details>
      </Section>

      <Section title="Standardwoche" hint="Tage ohne Eintrag sind Ruhetage.">
        {template.map((t) => <Row key={t.id} table="week_template" id={t.id}>{templateFields(t)}</Row>)}
        <details><summary className="cursor-pointer text-sm text-orange-400">+ Einheit hinzufügen</summary><div className="mt-2"><Row table="week_template">{templateFields()}</Row></div></details>
      </Section>

      <Section title="Manuelle Änderungen" hint="Verschiebungen und Absagen aus dem Kalender. Löschen stellt die ursprüngliche Einheit wieder her.">
        {overrides.length === 0 && <p className="text-sm text-zinc-500">Keine.</p>}
        {overrides
          .sort((a, b) => a.slot_key.localeCompare(b.slot_key))
          .map((o) => {
            const [d, type] = o.slot_key.split("|");
            return (
              <div key={o.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 p-3 text-sm">
                <div>
                  <div className="font-medium">
                    {SESSION_TYPE_LABELS[type as keyof typeof SESSION_TYPE_LABELS] ?? type} am {formatDate(d)}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {o.action === "cancel" ? "abgesagt" : `verschoben auf ${formatDate(o.new_date!)}${o.new_time ? ` ${o.new_time}` : ""}`}
                    {o.note && ` · ${o.note}`}
                  </div>
                </div>
                <ActionButton
                  action={deletePlanRowAction.bind(null, "plan_overrides", o.id!)}
                  label="Löschen"
                  className="btn-ghost py-1.5 text-xs text-red-400"
                />
              </div>
            );
          })}
      </Section>
    </>
  );
}
