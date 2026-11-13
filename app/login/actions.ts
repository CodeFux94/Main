"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export interface LoginState {
  error?: string;
  email?: string;
}

const schema = z.object({
  email: z.email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(1, "Bitte das Passwort eingeben."),
});

const GENERIC_ERROR = "E-Mail oder Passwort falsch.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = schema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { email, error: parsed.error.issues[0].message };

  // Nur die eigene Adresse darf sich anmelden. Gleiche Meldung wie bei falschem
  // Passwort, damit nicht erkennbar ist, welche Adresse berechtigt ist.
  if (parsed.data.email !== serverEnv.allowedEmail()) return { email, error: GENERIC_ERROR };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.status === 429) return { email, error: "Zu viele Versuche – bitte kurz warten." };
    return { email, error: GENERIC_ERROR };
  }
  redirect("/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
