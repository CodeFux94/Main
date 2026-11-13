export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="mt-4 text-xl font-bold">Keine Verbindung</h1>
      <p className="mt-2 text-sm text-zinc-400">Sobald du wieder online bist, lädt die App die aktuellen Daten.</p>
    </main>
  );
}
