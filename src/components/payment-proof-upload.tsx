"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { uploadPaymentProof } from "@/app/actions/team";

type PaymentProofUploadProps = {
  teamId: string;
};

export function PaymentProofUpload({ teamId }: PaymentProofUploadProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("team_id", teamId);

    const file = fd.get("proof") as File | null;
    if (!file || file.size === 0) {
      setError("Pilih file bukti transfer.");
      return;
    }
    if (file.size > 9 * 1024 * 1024) {
      setError("File terlalu besar (maks. 9 MB).");
      return;
    }

    startTransition(async () => {
      const result = await uploadPaymentProof({}, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(result.success ?? "Bukti terkirim.");
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--muted)]">File bukti (JPG/PNG/PDF)</span>
        <input
          name="proof"
          type="file"
          required
          accept="image/*,application/pdf"
          className="input"
          disabled={pending}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--muted)]">Catatan (opsional)</span>
        <input
          name="note"
          className="input"
          placeholder="Nama pengirim / bank"
          disabled={pending}
        />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Mengirim..." : "Kirim bukti"}
      </button>
      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}
    </form>
  );
}
