"use client";

import { useActionState, useEffect, useState } from "react";
import { SuccessConfirmation } from "@/components/success-confirmation";

type State = { error?: string; success?: string };

export function ActionForm({
  action,
  children,
  className,
  id,
  onSuccess,
  successDialog = false,
  successTitle,
  compactStatus = false,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  children: React.ReactNode;
  className?: string;
  id?: string;
  onSuccess?: () => void;
  /** Tampilkan dialog sukses bertema (bukan hanya teks hijau) */
  successDialog?: boolean;
  successTitle?: string;
  /** Status singkat (untuk baris tabel / toolbar) */
  compactStatus?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as State);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  useEffect(() => {
    if (!state.success) return;
    if (successDialog) {
      setDialogMessage(state.success);
      setDialogOpen(true);
    }
    onSuccess?.();
  }, [state.success, onSuccess, successDialog]);

  const statusPending = pending ? (
    <p
      className={
        compactStatus
          ? "text-[10px] text-[var(--muted)]"
          : "text-sm text-[var(--muted)]"
      }
    >
      Menyimpan...
    </p>
  ) : null;

  const statusError = state.error ? (
    <p
      className={
        compactStatus
          ? "max-w-[9rem] truncate text-[10px] text-red-300"
          : "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
      }
      title={state.error}
    >
      {state.error}
    </p>
  ) : null;

  const statusSuccess =
    state.success && !successDialog ? (
      <p
        className={
          compactStatus
            ? "max-w-[9rem] truncate text-[10px] text-emerald-300"
            : "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        }
        title={state.success}
      >
        {state.success}
      </p>
    ) : null;

  return (
    <>
      <form action={formAction} className={className} id={id}>
        {children}
        {statusPending}
        {statusError}
        {statusSuccess}
      </form>

      {successDialog && (
        <SuccessConfirmation
          open={dialogOpen}
          title={successTitle ?? "Berhasil disimpan!"}
          message={dialogMessage}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
