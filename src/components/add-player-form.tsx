"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addPlayer,
  addPlayerWithDocuments,
  type ActionState,
} from "@/app/actions/players";
import {
  inputTypeForPlayerField,
  isBuiltinPlayerFieldKey,
} from "@/lib/player-fields";

export type PlayerFieldDef = {
  id: string;
  key: string;
  label: string;
  placeholder: string | null;
  fieldType: string;
  required: boolean;
};

export type DocCardDef = {
  id: string;
  key: string;
  label: string;
  required: boolean;
  active?: boolean;
};

type PendingDoc = {
  id: string;
  docType: string;
  label: string;
  file: File;
};

type AddPlayerFormProps = {
  teamId: string;
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
  canAdd: boolean;
};

export function AddPlayerForm({
  teamId,
  fields,
  docCards,
  minPlayerDocuments,
  canAdd,
}: AddPlayerFormProps) {
  const [formKey, setFormKey] = useState(0);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [draftType, setDraftType] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();

  const requiredCards = docCards.filter((c) => c.required);
  const neededDocs =
    requiredCards.length > 0
      ? requiredCards.length
      : Math.max(1, minPlayerDocuments);

  const minHint =
    requiredCards.length > 0
      ? `Unggah minimal ${neededDocs} kartu wajib sebelum menyimpan: ${requiredCards.map((c) => c.label).join(", ")}.`
      : `Unggah minimal ${neededDocs} berkas sesuai ketentuan admin sebelum tombol Simpan aktif.`;

  const remaining = useMemo(
    () => docCards.filter((c) => !pendingDocs.some((d) => d.docType === c.key)),
    [docCards, pendingDocs]
  );

  const canSave =
    docCards.length === 0
      ? true
      : pendingDocs.length >= neededDocs &&
        (requiredCards.length === 0 ||
          requiredCards.every((c) =>
            pendingDocs.some((d) => d.docType === c.key)
          ));

  function addPendingDoc() {
    setLocalError(null);
    if (!draftType) {
      setLocalError("Pilih kartu dokumen terlebih dahulu.");
      return;
    }
    if (!draftFile || draftFile.size === 0) {
      setLocalError("Pilih file berkas terlebih dahulu.");
      return;
    }
    const card = docCards.find((c) => c.key === draftType);
    if (!card) {
      setLocalError("Kartu tidak valid.");
      return;
    }
    if (pendingDocs.some((d) => d.docType === draftType)) {
      setLocalError("Kartu ini sudah ditambahkan.");
      return;
    }
    setPendingDocs((prev) => [
      ...prev,
      {
        id: `${draftType}-${Date.now()}`,
        docType: draftType,
        label: card.label,
        file: draftFile,
      },
    ]);
    setDraftType("");
    setDraftFile(null);
  }

  function removePending(id: string) {
    setPendingDocs((prev) => prev.filter((d) => d.id !== id));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setState({});

    if (docCards.length > 0 && !canSave) {
      setLocalError(
        `Minimal ${neededDocs} berkas harus ditambahkan sebelum menyimpan.`
      );
      return;
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("team_id", teamId);
    fd.set("doc_count", String(pendingDocs.length));
    pendingDocs.forEach((doc, i) => {
      fd.set(`doc_type_${i}`, doc.docType);
      fd.set(`file_${i}`, doc.file, doc.file.name);
    });

    startTransition(async () => {
      const result =
        docCards.length > 0
          ? await addPlayerWithDocuments({}, fd)
          : await addPlayer({}, fd);
      setState(result);
      if (result.success) {
        setPendingDocs([]);
        setDraftType("");
        setDraftFile(null);
        setFormKey((k) => k + 1);
      }
    });
  }

  if (!canAdd) {
    return (
      <p className="text-sm text-amber-300">Kuota pemain tim sudah penuh.</p>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="text-sm text-amber-300">
        Admin belum mengatur field form untuk turnamen ini.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" key={formKey}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => {
          const wide =
            field.key === "full_name" ||
            field.key === "position" ||
            !isBuiltinPlayerFieldKey(field.key);
          return (
            <label
              key={field.id}
              className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}
            >
              <span className="text-[var(--muted)]">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              <input
                name={`field_${field.key}`}
                className="input"
                required={field.required}
                type={inputTypeForPlayerField(field.fieldType)}
                placeholder={
                  field.fieldType === "date"
                    ? undefined
                    : (field.placeholder ?? undefined)
                }
              />
            </label>
          );
        })}
      </div>

      {docCards.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-medium text-white">Berkas identitas</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {minHint}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Progress: {pendingDocs.length} / {neededDocs} berkas siap
          </p>

          {pendingDocs.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pendingDocs.map((doc, i) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm"
                >
                  <span className="text-emerald-200">
                    {i + 1}. {doc.label}{" "}
                    <span className="text-emerald-200/70">
                      · {doc.file.name}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removePending(doc.id)}
                    className="btn-ghost px-2 py-1 text-xs text-red-300"
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          )}

          {remaining.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">
                  Kartu dokumen {pendingDocs.length + 1}
                </span>
                <select
                  className="input"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value)}
                >
                  <option value="">Pilih kartu…</option>
                  {remaining.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.label}
                      {c.required ? " (wajib)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <span className="text-[var(--muted)]">File</span>
                <input
                  key={`${pendingDocs.length}-${draftType}`}
                  type="file"
                  accept="image/*,application/pdf"
                  className="input"
                  onChange={(e) =>
                    setDraftFile(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              <button
                type="button"
                onClick={addPendingDoc}
                className="btn-ghost shrink-0 border border-white/15"
              >
                Tambah berkas
              </button>
            </div>
          )}
        </div>
      )}

      {(localError || state.error) && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {localError || state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {state.success}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !canSave}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          title={
            !canSave
              ? `Unggah minimal ${neededDocs} berkas dulu`
              : undefined
          }
        >
          {isPending ? "Menyimpan…" : "Simpan pemain"}
        </button>
        {!canSave && docCards.length > 0 && (
          <span className="text-xs text-[var(--muted)]">
            Tombol aktif setelah {neededDocs} berkas ditambahkan (
            {pendingDocs.length}/{neededDocs})
          </span>
        )}
      </div>
    </form>
  );
}
