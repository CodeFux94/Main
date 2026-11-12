import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500 text-2xl font-black text-zinc-950">
          E1
        </div>
        <h1 className="text-2xl font-bold">Enduro One 2027</h1>
        <p className="mt-1 text-sm text-zinc-400">Persönlicher Trainingsplan</p>
      </div>
      <LoginForm />
    </main>
  );
}
