"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  deleteTournamentRule,
  saveTournamentRule,
} from "@/app/actions/rules";
import { RulesRichEditor } from "@/components/rules-rich-editor";
import { SuccessConfirmation } from "@/components/success-confirmation";
import { legacyRuleToHtml, type RulePoint } from "@/lib/rules-html";

type State = { error?: string; success?: string };

type RuleEditorPanelProps = {
  mode: "create" | "edit";
  id?: string;
  defaultPasalNumber: number;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultPoints?: RulePoint[];
};

export function RuleEditorPanel({
  mode,
  id,
  defaultPasalNumber,
  defaultTitle = "",
  defaultDescription = "",
  defaultPoints = [],
}: RuleEditorPanelProps) {
  const [saveState, saveAction, savePending] = useActionState(
    saveTournamentRule,
    {} as State
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTournamentRule,
    {} as State
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");

  const initialHtml = useMemo(() => {
    const desc = defaultDescription.trim();
    const looksHtml = /<\/?[a-z][\s\S]*>/i.test(desc);
    if (looksHtml) return desc;
    return legacyRuleToHtml(desc, defaultPoints);
  }, [defaultDescription, defaultPoints]);

  useEffect(() => {
    const msg = saveState.success || deleteState.success;
    if (!msg) return;
    setDialogMessage(msg);
    setDialogOpen(true);
  }, [saveState.success, deleteState.success]);

  const error = saveState.error || deleteState.error;
  const pending = savePending || deletePending;

  return (
    <div className="overflow-hidden rounded-md border-2 border-slate-300 bg-[#f4f7fb] text-slate-900 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="border-b-2 border-slate-400 bg-[#e8eef5] px-5 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
          {mode === "create"
            ? "Pasal baru — editor dokumen"
            : `Edit pasal ${defaultPasalNumber}`}
        </p>
      </div>

      <form action={saveAction} className="space-y-4 p-5">
        {id && <input type="hidden" name="id" value={id} />}

        <div className="flex flex-wrap items-end gap-3 rounded border-2 border-slate-300 bg-white p-3">
          <label className="flex w-28 flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">Pasal *</span>
            <input
              name="pasal_number"
              type="number"
              min={1}
              max={999}
              required
              className="rules-word-input"
              defaultValue={defaultPasalNumber}
            />
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-slate-600">Judul *</span>
            <input
              name="title"
              required
              className="rules-word-input"
              defaultValue={defaultTitle}
              placeholder="Contoh: Format pertandingan"
            />
          </label>
        </div>

        <RulesRichEditor
          name="body_html"
          defaultHtml={initialHtml}
          placeholder="Tulis isi pasal: paragraf, bullet, nomor, sub-poin..."
        />

        {error && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-slate-300 pt-4">
          <button
            type="submit"
            className="rounded border border-sky-700 bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
            disabled={pending}
          >
            {savePending
              ? "Menyimpan..."
              : mode === "create"
                ? "Tambah pasal"
                : "Simpan pasal"}
          </button>
          {mode === "edit" && id && (
            <button
              type="submit"
              formAction={deleteAction}
              className="rounded border border-red-400 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              disabled={pending}
              onClick={(e) => {
                if (!confirm("Hapus pasal ini?")) e.preventDefault();
              }}
            >
              {deletePending ? "Menghapus..." : "Hapus pasal"}
            </button>
          )}
        </div>
      </form>

      <SuccessConfirmation
        open={dialogOpen}
        title={mode === "create" ? "Pasal ditambahkan" : "Pasal diperbarui"}
        message={dialogMessage}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
