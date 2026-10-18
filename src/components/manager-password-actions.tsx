"use client";

import { useActionState, useEffect, useState } from "react";
import {
  adminCreateManagerRecoveryLink,
  adminSetManagerPassword,
  type ManagerActionState,
} from "@/app/actions/managers";
import { PasswordField } from "@/components/password-field";

type Props = {
  userId: string;
  email: string | null;
  teamName: string;
};

export function ManagerPasswordActions({ userId, email, teamName }: Props) {
  const [open, setOpen] = useState(false);
  const [setState, setAction, setPending] = useActionState(
    adminSetManagerPassword,
    {} as ManagerActionState
  );
  const [linkState, linkAction, linkPending] = useActionState(
    adminCreateManagerRecoveryLink,
    {} as ManagerActionState
  );

  useEffect(() => {
    if (setState.tempPassword || linkState.recoveryLink) setOpen(true);
  }, [setState.tempPassword, linkState.recoveryLink]);

  const pending = setPending || linkPending;
  const error = setState.error || linkState.error;
  const success = setState.success || linkState.success;

  return (
    <div className="space-y-2 text-left">
      <button
        type="button"
        className="btn-ghost border border-white/15 px-2.5 py-1 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Tutup" : "Reset password"}
      </button>

      {open && (
        <div className="min-w-[14rem] space-y-2 rounded-md border border-white/10 bg-black/30 p-2">
          <p className="text-[11px] text-[var(--muted)]">
            {teamName}
            {email ? ` · ${email}` : ""}
          </p>

          <form action={setAction} className="space-y-2">
            <input type="hidden" name="user_id" value={userId} />
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="text-[var(--muted)]">
                Password sementara (kosongkan = acak)
              </span>
              <PasswordField
                name="password"
                inputClassName="py-1.5 text-xs"
                placeholder="Minimal 6 karakter"
                minLength={6}
                autoComplete="off"
                disabled={pending || !email}
              />
            </label>
            <button
              type="submit"
              disabled={pending || !email}
              className="btn-primary w-full px-2 py-1.5 text-xs disabled:opacity-40"
            >
              {setPending ? "Menyimpan…" : "Set password sementara"}
            </button>
          </form>

          <form action={linkAction}>
            <input type="hidden" name="user_id" value={userId} />
            <input type="hidden" name="email" value={email ?? ""} />
            <button
              type="submit"
              disabled={pending || !email}
              className="btn-ghost w-full border border-white/15 px-2 py-1.5 text-xs disabled:opacity-40"
            >
              {linkPending ? "Membuat…" : "Buat tautan reset"}
            </button>
          </form>

          {!email && (
            <p className="text-[11px] text-amber-200">
              Email Auth tidak ditemukan untuk akun ini.
            </p>
          )}

          {error && (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
              {success}
            </p>
          )}
          {setState.tempPassword && (
            <div className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-amber-200">
                Password sementara
              </p>
              <p className="mt-0.5 break-all font-mono text-sm text-white">
                {setState.tempPassword}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Salin sekarang. Tidak ditampilkan lagi setelah refresh.
              </p>
            </div>
          )}
          {linkState.recoveryLink && (
            <div className="rounded border border-sky-400/40 bg-sky-500/10 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-sky-200">
                Tautan reset
              </p>
              <a
                href={linkState.recoveryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block break-all text-[11px] text-sky-200 underline"
              >
                {linkState.recoveryLink}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
