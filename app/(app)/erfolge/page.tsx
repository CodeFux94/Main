import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Erfolge" };

export default function ErfolgePage() {
  return (
    <>
      <PageHeader title="Erfolge" />
      <div className="card text-sm text-zinc-400">
        Serien, Bestwerte, Meilensteine und Badges erscheinen hier, sobald Strava verbunden ist (Etappe 4).
      </div>
    </>
  );
}
