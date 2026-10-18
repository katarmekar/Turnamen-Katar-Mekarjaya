"use client";

import { useActionState, useEffect, useState } from "react";
import { saveTournamentRulesHeader } from "@/app/actions/rules";
import { SuccessConfirmation } from "@/components/success-confirmation";

type State = { error?: string; success?: string };

type RulesHeaderEditorProps = {
  defaultEyebrow: string;
  defaultTitle: string;
  defaultSubtitle: string;
  /** Nilai yang ditampilkan di baris meta (tersimpan atau otomatis) */
  defaultMeta: string;
};

export function RulesHeaderEditor({
  defaultEyebrow,
  defaultTitle,
  defaultSubtitle,
  defaultMeta,
}: RulesHeaderEditorProps) {
  const [state, action, pending] = useActionState(
    saveTournamentRulesHeader,
    {} as State
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (state.success) setDialogOpen(true);
  }, [state.success]);

  return (
    <div className="overflow-hidden rounded-md border-2 border-slate-300 bg-[#f4f7fb] text-slate-900 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="border-b-2 border-slate-400 bg-[#e8eef5] px-5 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          Header dokumen
        </p>
      </div>

      <form action={action} className="space-y-4 p-5">
        <div className="space-y-3 rounded border-2 border-slate-300 bg-white p-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">Label atas</span>
            <input
              name="header_eyebrow"
              className="rules-word-input"
              defaultValue={defaultEyebrow}
              placeholder="Contoh: Dokumen resmi"
              maxLength={80}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">Judul dokumen *</span>
            <input
              name="header_title"
              required
              className="rules-word-input"
              defaultValue={defaultTitle}
              placeholder="Contoh: Peraturan Turnamen"
              maxLength={160}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">
              Subjudul / keterangan
            </span>
            <textarea
              name="header_subtitle"
              rows={2}
              className="rules-word-input min-h-[4.5rem] resize-y"
              defaultValue={defaultSubtitle}
              placeholder="Contoh: PERATURAN & TATA TERTIB TURNAMEN MINISOCCER&#10;Kategori: Tingkat SD."
              maxLength={400}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">Baris meta</span>
            <input
              name="header_meta"
              className="rules-word-input"
              defaultValue={defaultMeta}
              placeholder="Contoh: Nama turnamen · Versi 1"
              maxLength={200}
            />
            <span className="text-xs text-slate-500">
              Teks di bawah subjudul. Jika sama dengan otomatis atau dikosongkan,
              akan mengikuti nama turnamen dan nomor versi.
            </span>
          </label>
        </div>

        {state.error && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-slate-300 pt-4">
          <button
            type="submit"
            className="rounded border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            disabled={pending}
          >
            {pending ? "Menyimpan..." : "Simpan header"}
          </button>
        </div>
      </form>

      <SuccessConfirmation
        open={dialogOpen}
        title="Header diperbarui"
        message={state.success ?? ""}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
