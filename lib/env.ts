// Zentrale Umgebungsvariablen.
// Akzeptiert sowohl die Namen aus .env.example als auch die Namen, die die
// Supabase-Integration von Vercel automatisch anlegt (ANON_KEY / SERVICE_ROLE_KEY).

function first(...values: (string | undefined)[]): string | undefined {
  return values.map((v) => v?.trim()).find((v) => v);
}

/** Öffentliche Werte – auch in proxy.ts nutzbar. */
export function resolvePublicSupabase() {
  return {
    url: first(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL),
    key: first(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_PUBLISHABLE_KEY,
      process.env.SUPABASE_ANON_KEY,
    ),
  };
}

export const URL_VAR_NAMES = "NEXT_PUBLIC_SUPABASE_URL (oder SUPABASE_URL)";
export const KEY_VAR_NAMES = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (oder NEXT_PUBLIC_SUPABASE_ANON_KEY)";
export const SECRET_VAR_NAMES = "SUPABASE_SECRET_KEY (oder SUPABASE_SERVICE_ROLE_KEY)";

export function resolveSecretKey() {
  return first(process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Umgebungsvariable ${name} fehlt (siehe README, Schritt 5)`);
  return value;
}

export const publicEnv = {
  supabaseUrl: () => required(URL_VAR_NAMES, resolvePublicSupabase().url),
  supabaseKey: () => required(KEY_VAR_NAMES, resolvePublicSupabase().key),
};

export const serverEnv = {
  supabaseSecretKey: () => required(SECRET_VAR_NAMES, resolveSecretKey()),
  allowedEmail: () => required("ALLOWED_EMAIL", process.env.ALLOWED_EMAIL).trim().toLowerCase(),
};
