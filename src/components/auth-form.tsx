"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AuthActionState } from "@/app/actions/auth";

type AuthFormProps = {
  mode: "login" | "register";
  action: (
    prev: AuthActionState,
    formData: FormData
  ) => Promise<AuthActionState>;
  nextPath?: string;
};

const initialState: AuthActionState = {};

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {mode === "register" && (
        <>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--muted)]">Nama lengkap</span>
            <input
              name="full_name"
              required
              autoComplete="name"
              className="input"
              placeholder="Nama kapten tim"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-[var(--muted)]">No. HP / WhatsApp</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              className="input"
              placeholder="08xxxxxxxxxx"
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--muted)]">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="email@contoh.com"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--muted)]">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="input"
          placeholder="Minimal 6 karakter"
        />
      </label>

      {mode === "login" && nextPath && (
        <input type="hidden" name="next" value={nextPath} />
      )}

      {state.error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {state.success}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {pending
          ? "Memproses..."
          : mode === "login"
            ? "Masuk"
            : "Daftar akun"}
      </button>

      <p className="text-center text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Daftar
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Masuk
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
