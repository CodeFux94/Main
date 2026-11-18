import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl" aria-hidden>🧭</div>
      <h1 className="mt-4 text-xl font-bold">Seite nicht gefunden</h1>
      <p className="mt-2 text-sm text-zinc-400">Diese Seite gibt es nicht (mehr).</p>
      <Link href="/" className="btn-secondary mt-6">Zum Dashboard</Link>
    </main>
  );
}
