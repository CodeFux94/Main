"use client";

import { useEffect, useState } from "react";

/** Zeigt den Abo-Link für den Apple Kalender (webcal://…). */
export function IcsHint({ token }: { token: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Origin ist nur im Browser bekannt
  useEffect(() => setOrigin(window.location.host), []);
  if (!origin) return null;
  const https = `https://${origin}/api/ics/${token}`;
  const webcal = `webcal://${origin}/api/ics/${token}`;
  return (
    <details className="card mt-4 text-sm">
      <summary className="cursor-pointer font-semibold">Im Apple Kalender abonnieren</summary>
      <p className="mt-2 text-zinc-400">
        Tippe auf „Abonnieren“. Auf dem iPhone öffnet sich der Kalender und fragt nach der Bestätigung. Der Kalender
        aktualisiert sich dann automatisch.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={webcal} className="btn-primary">
          Abonnieren
        </a>
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard.writeText(https).then(() => setCopied(true))}
        >
          {copied ? "Kopiert ✓" : "Link kopieren"}
        </button>
      </div>
      <p className="mt-2 break-all font-mono text-[11px] text-zinc-500">{https}</p>
    </details>
  );
}
