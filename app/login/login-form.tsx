"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "email" });

  return (
    <form action={action} className="space-y-4">
      {state.step === "email" ? (
        <>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-400">E-Mail-Adresse</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.email}
              className="input"
              placeholder="du@example.com"
            />
          </label>
          <button name="intent" value="send" disabled={pending} className="btn-primary w-full">
            {pending ? "Sende …" : "Login-Code anfordern"}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email ?? ""} />
          <p className="text-sm text-zinc-400">
            Code an <span className="text-zinc-200">{state.email}</span>
          </p>
          <label className="block">
            <span className="mb-1 block text-sm text-zinc-400">Code aus der E-Mail</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={12}
              className="input text-center text-2xl tracking-[0.4em]"
              placeholder="123456"
              autoFocus
            />
          </label>
          <button name="intent" value="verify" disabled={pending} className="btn-primary w-full">
            {pending ? "Prüfe …" : "Anmelden"}
          </button>
          <button name="intent" value="back" formNoValidate className="btn-ghost w-full">
            Andere Adresse / neuen Code
          </button>
        </>
      )}
      {state.info && !state.error && <p className="text-sm text-emerald-400">{state.info}</p>}
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
