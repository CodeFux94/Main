import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Berichte" };

export default function BerichtePage() {
  return (
    <>
      <PageHeader title="Berichte" />
      <div className="card text-sm text-zinc-400">
        Hier landen ab Etappe 5 jeden Montag automatisch das Wochenreview und am Ende jeder Phase ein Phasenbericht.
      </div>
    </>
  );
}
