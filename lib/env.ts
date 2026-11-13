// Zentrale, geprüfte Umgebungsvariablen (nur serverseitig importieren,
// außer den NEXT_PUBLIC_-Werten).
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt (siehe .env.example)`);
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseKey: () =>
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
};

export const serverEnv = {
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  allowedEmail: () => required("ALLOWED_EMAIL", process.env.ALLOWED_EMAIL).trim().toLowerCase(),
};
