"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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

type DocSlot = {
  docType: string;
  file: File | null;
};

type AddPlayerFormProps = {
  teamId: string;
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
  canAdd: boolean;
  /** Admin: boleh simpan tanpa berkas wajib */
  documentsOptional?: boolean;
};

function emptySlots(count: number): DocSlot[] {
  return Array.from({ length: count }, () => ({ docType: "", file: null }));
}

export function AddPlayerForm({
  teamId,
  fields,
  docCards,
  minPlayerDocuments,
  canAdd,
  documentsOptional = false,
}: AddPlayerFormProps) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();

  const requiredCards = docCards.filter((c) => c.required);
  const maxDocs = docCards.length;
  const neededDocs = documentsOptional
    ? 0
    : Math.min(
        maxDocs,
        requiredCards.length > 0
          ? requiredCards.length
          : Math.max(1, minPlayerDocuments)
      );

  const [slots, setSlots] = useState<DocSlot[]>(() => emptySlots(neededDocs));

  useEffect(() => {
    setSlots(emptySlots(neededDocs));
  }, [neededDocs, formKey]);

  useEffect(() => {
    if (!state.success) return;
    const timer = window.setTimeout(() => {
      setState((prev) =>
        prev.success ? { ...prev, success: undefined } : prev
      );
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [state.success]);

  const filledCount = slots.filter((s) => s.docType && s.file).length;
  const canAddSlot = slots.length < maxDocs;

  const canSave =
    documentsOptional || docCards.length === 0
      ? true
      : filledCount >= neededDocs &&
        (requiredCards.length === 0 ||
          requiredCards.every((c) =>
            slots.some((s) => s.docType === c.key && s.file)
          ));

  const minHint = documentsOptional
    ? `Berkas opsional untuk admin. Boleh kosong, atau isi sampai ${maxDocs} kartu.`
    : requiredCards.length > 0
      ? `Isi ${neededDocs} kartu wajib di bawah: ${requiredCards.map((c) => c.label).join(", ")}. Bisa tambah sampai ${maxDocs} kartu.`
      : `Isi minimal ${neededDocs} kartu dokumen. Bisa tambah sampai ${maxDocs} kartu yang disediakan admin.`;

  const optionsForSlot = useMemo(() => {
    return slots.map((_, index) => {
      const takenElsewhere = new Set(
        slots
          .map((s, i) => (i !== index && s.docType ? s.docType : null))
          .filter(Boolean) as string[]
      );
      return docCards.filter((c) => !takenElsewhere.has(c.key));
    });
  }, [docCards, slots]);

  function updateSlot(index: number, patch: Partial<DocSlot>) {
    setSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
  }

  function addDocSlot() {
    setLocalError(null);
    setSlots((prev) => {
      if (prev.length >= maxDocs) return prev;
      return [...prev, { docType: "", file: null }];
    });
  }

  function removeDocSlot(index: number) {
    if (index < neededDocs) return;
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    setState({});

    if (!documentsOptional && docCards.length > 0 && !canSave) {
      setLocalError(
        `Lengkapi minimal ${neededDocs} berkas sebelum menyimpan pemain.`
      );
      return;
    }

    const filled = slots.filter((s) => s.docType && s.file);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("team_id", teamId);
    fd.set("doc_count", String(filled.length));
    filled.forEach((slot, i) => {
      fd.set(`doc_type_${i}`, slot.docType);
      fd.set(`file_${i}`, slot.file!, slot.file!.name);
    });

    startTransition(async () => {
      const result =
        filled.length > 0
          ? await addPlayerWithDocuments({}, fd)
          : await addPlayer({}, fd);
      setState(result);
      if (result.success) {
        setFormKey((k) => k + 1);
        router.refresh();
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
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">Foto pemain (opsional)</span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            className="input"
          />
          <span className="text-xs text-[var(--muted)]">
            Format gambar, maksimal 5 MB. Boleh dikosongkan.
          </span>
        </label>
      </div>

      {docCards.length > 0 && (
        <div className="border-t border-white/10 pt-4">
          <h3 className="text-sm font-medium text-white">Berkas identitas</h3>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {minHint}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {documentsOptional
              ? `Terisi: ${filledCount} · slot ${slots.length} / ${maxDocs}`
              : `Progress: ${filledCount} / ${neededDocs} minimal · ${slots.length} / ${maxDocs} slot`}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {slots.map((slot, index) => {
              const options = optionsForSlot[index] ?? [];
              const selected = docCards.find((c) => c.key === slot.docType);
              const ready = Boolean(slot.docType && slot.file);
              const isExtra = index >= neededDocs;

              return (
                <div
                  key={`slot-${index}`}
                  className={
                    ready
                      ? "rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3"
                      : "rounded-md border border-white/10 bg-black/20 p-3"
                  }
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-white">
                      Kartu dokumen {index + 1}
                      {selected?.required
                        ? " (wajib)"
                        : isExtra
                          ? " (tambahan)"
                          : ""}
                    </p>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => removeDocSlot(index)}
                        className="text-xs text-red-300 hover:underline"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-[var(--muted)]">Jenis berkas</span>
                    <select
                      className="input"
                      value={slot.docType}
                      onChange={(e) =>
                        updateSlot(index, {
                          docType: e.target.value,
                          file: null,
                        })
                      }
                      required={index < neededDocs}
                    >
                      <option value="">Pilih kartu…</option>
                      {options.map((c) => (
                        <option key={c.id} value={c.key}>
                          {c.label}
                          {c.required ? " (wajib)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-2 flex flex-col gap-1 text-sm">
                    <span className="text-[var(--muted)]">File</span>
                    <input
                      key={`${formKey}-${index}-${slot.docType}`}
                      type="file"
                      accept="image/*,application/pdf"
                      className="input"
                      required={index < neededDocs}
                      disabled={!slot.docType}
                      onChange={(e) =>
                        updateSlot(index, {
                          file: e.target.files?.[0] ?? null,
                        })
                      }
                    />
                  </label>
                  {slot.file && (
                    <p className="mt-2 truncate text-xs text-emerald-200">
                      {slot.file.name}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {(canAddSlot || (documentsOptional && slots.length === 0 && maxDocs > 0)) && (
            <button
              type="button"
              onClick={() => {
                if (slots.length === 0 && documentsOptional) {
                  setSlots(emptySlots(1));
                  return;
                }
                addDocSlot();
              }}
              className="btn-ghost mt-3 border border-white/15"
            >
              Tambah dokumen
            </button>
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

      <div className="flex flex-col items-center gap-2">
        <button
          type="submit"
          disabled={isPending || !canSave}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          title={
            !canSave
              ? `Lengkapi ${neededDocs} berkas dulu`
              : undefined
          }
        >
          {isPending ? "Menyimpan…" : "Simpan pemain"}
        </button>
        {!canSave && docCards.length > 0 && !documentsOptional && (
          <span className="text-center text-xs text-[var(--muted)]">
            Tombol aktif setelah {neededDocs} berkas diisi (
            {filledCount}/{neededDocs})
          </span>
        )}
      </div>
    </form>
  );
}
