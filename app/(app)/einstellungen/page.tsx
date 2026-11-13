import type { Metadata } from "next";
import Link from "next/link";
import { getSettings, requireUser } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { ActionForm } from "@/components/action-form";
import { ActionButton } from "@/components/action-button";
import { logoutAction } from "@/app/login/actions";
import { IcsHint } from "../kalender/ics-hint";
import { rotateIcsTokenAction, saveProfileAction, saveZonesAction } from "./actions";

export const metadata: Metadata = { title: "Einstellungen" };

export default async function EinstellungenPage() {
  const { supabase, email } = await requireUser();
  const s = await getSettings(supabase);

  return (
    <>
      <PageHeader title="Einstellungen" subtitle={email ?? undefined} />

      <section className="card mb-4">
        <h2 className="mb-1 font-semibold">Strava</h2>
        <p className="text-sm text-zinc-400">Die Verbindung zu Strava folgt in Etappe 2.</p>
      </section>

      <section className="card mb-4">
        <h2 className="mb-3 font-semibold">Leistung & Gewicht</h2>
        <ActionForm action={saveProfileAction}>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">FTP (W)</span>
              <input name="ftp_w" type="number" inputMode="numeric" defaultValue={s.ftp_w} className="input" />
            </label>
            <label>
              <span className="label">Gewicht (kg)</span>
              <input name="weight_kg" inputMode="decimal" defaultValue={String(s.weight_kg).replace(".", ",")} className="input" />
            </label>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {(s.ftp_w / s.weight_kg).toLocaleString("de-DE", { maximumFractionDigits: 2 })} W/kg
          </p>
        </ActionForm>
      </section>

      <section className="card mb-4">
        <h2 className="mb-1 font-semibold">Herzfrequenz-Zonen</h2>
        <p className="mb-3 text-xs text-zinc-500">Untergrenze jeder Zone in bpm. Z1 = alles unter Z2.</p>
        <ActionForm action={saveZonesAction}>
          <div className="grid grid-cols-4 gap-2">
            {(["hr_z2", "hr_z3", "hr_z4", "hr_z5"] as const).map((k, i) => (
              <label key={k}>
                <span className="label">Z{i + 2} ab</span>
                <input name={k} type="number" inputMode="numeric" defaultValue={s[k]} className="input px-2 text-center" />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Z1 &lt; {s.hr_z2} · Z2 {s.hr_z2}–{s.hr_z3 - 1} · Z3 {s.hr_z3}–{s.hr_z4 - 1} · Z4 {s.hr_z4}–{s.hr_z5 - 1} · Z5 ≥ {s.hr_z5}
          </p>
        </ActionForm>
      </section>

      <section className="card mb-4">
        <h2 className="mb-1 font-semibold">Trainingsplan</h2>
        <p className="mb-3 text-sm text-zinc-400">Rennen, Phasen, Entlastungswochen und Standardwoche bearbeiten.</p>
        <Link href="/einstellungen/plan" className="btn-secondary">
          Plan bearbeiten →
        </Link>
      </section>

      <IcsHint token={s.ics_token} />
      <div className="mt-2 px-1">
        <ActionButton
          action={rotateIcsTokenAction}
          label="Kalender-Link neu erzeugen"
          className="btn-ghost px-0 text-xs"
          confirmText="Der bisherige Abo-Link funktioniert danach nicht mehr. Fortfahren?"
        />
      </div>

      <form action={logoutAction} className="mt-6">
        <button className="btn-danger w-full">Abmelden</button>
      </form>
    </>
  );
}
