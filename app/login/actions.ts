"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export interface LoginState {
  step: "email" | "code";
  email?: string;
  error?: string;
  info?: string;
}

const emailSchema = z.email("Bitte eine gültige E-Mail-Adresse eingeben.");

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  const supabase = await createClient();

  if (intent === "send") {
    const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
    if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
    const email = parsed.data;
    // Nur die eigene Adresse darf sich anmelden. Gleiche Antwort wie bei Erfolg,
    // damit nicht erkennbar ist, welche Adresse berechtigt ist.
    if (email !== serverEnv.allowedEmail()) {
      return { step: "code", email, info: "Falls die Adresse berechtigt ist, wurde ein Code verschickt." };
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return { step: "email", email, error: `Code konnte nicht gesendet werden: ${error.message}` };
    return { step: "code", email, info: "Code wurde per E-Mail verschickt." };
  }

  if (intent === "verify") {
    const email = prev.email ?? String(formData.get("email") ?? "");
    const token = String(formData.get("code") ?? "").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "Bitte den Code aus der E-Mail eingeben." };
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: "Code ungültig oder abgelaufen." };
    redirect("/");
  }

  if (intent === "back") return { step: "email" };
  return prev;
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
