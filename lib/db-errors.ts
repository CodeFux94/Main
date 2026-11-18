// Erkennt Fehler, die bedeuten: Migration fehlt noch (Tabelle/Funktion unbekannt).
// So läuft die App weiter, auch wenn eine neue Migration noch nicht ausgeführt wurde.
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    ["42P01", "42883", "PGRST205", "PGRST202", "42703"].includes(error.code ?? "") ||
    /does not exist|could not find the (table|function)/i.test(error.message ?? "")
  );
}

export const MIGRATION_HINT =
  "Datenbank noch nicht erweitert: Bitte im Supabase SQL Editor supabase/migrations/0002_strava.sql ausführen.";
