"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm text-zinc-400">E-Mail-Adresse</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={state.email}
          className="input"
          placeholder="du@example.com"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-zinc-400">Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Anmelden …" : "Anmelden"}
      </button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
