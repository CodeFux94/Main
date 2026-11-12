"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mt-6 border-red-900">
      <h2 className="font-semibold text-red-300">Etwas ist schiefgelaufen</h2>
      <p className="mt-2 break-words text-sm text-zinc-400">{error.message}</p>
      <button className="btn-secondary mt-4" onClick={reset}>
        Erneut versuchen
      </button>
    </div>
  );
}
