"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  deletePlayerAction,
  savePlayerAndUploadDocument,
  updatePlayer,
  type ActionState,
} from "@/app/actions/players";
import { playerDocsSatisfied } from "@/lib/doc-cards";
import {
  inputTypeForPlayerField,
  isBuiltinPlayerFieldKey,
} from "@/lib/player-fields";
import type { DocCardDef, PlayerFieldDef } from "@/components/add-player-form";

export type RosterPlayer = {
  id: string;
  fullName: string;
  identityNumber: string | null;
  jerseyNumber: number | null;
  position: string | null;
  extraData: Record<string, string>;
  documents: { id: string; docType: string }[];
};

type PlayersRosterTableProps = {
  teamId: string;
  players: RosterPlayer[];
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
};

function fieldValue(player: RosterPlayer, key: string): string {
  if (key === "full_name") return player.fullName;
  if (key === "identity_number") return player.identityNumber ?? "";
  if (key === "jersey_number")
    return player.jerseyNumber != null ? String(player.jerseyNumber) : "";
  if (key === "position") return player.position ?? "";
  return player.extraData[key] ?? "";
}

function formatExtra(value: string, fieldType: string) {
  if (fieldType === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return value;
}

function EditPlayerForm({
  teamId,
  player,
  fields,
  onDone,
}: {
  teamId: string;
  player: RosterPlayer;
  fields: PlayerFieldDef[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updatePlayer,
    {} as ActionState
  );

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="mt-3 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="player_id" value={player.id} />
      <div className="grid gap-2 sm:grid-cols-2">
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
                className="input py-1.5"
                required={field.required}
                type={inputTypeForPlayerField(field.fieldType)}
                defaultValue={fieldValue(player, field.key)}
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
      {state.error && (
        <p className="text-xs text-red-300">{state.error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary px-3 py-1.5 text-xs"
        >
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="btn-ghost px-3 py-1.5 text-xs"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function AddDocSlot({
  teamId,
  playerId,
  remaining,
  onUploaded,
}: {
  teamId: string;
  playerId: string;
  remaining: DocCardDef[];
  onUploaded: (docType: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [slotKey, setSlotKey] = useState(0);
  const [state, formAction, pending] = useActionState(
    savePlayerAndUploadDocument,
    {} as ActionState
  );

  useEffect(() => {
    if (!state.success || !state.docType) return;
    onUploaded(state.docType);
    setSlotKey((k) => k + 1);
    if (fileRef.current) fileRef.current.value = "";
  }, [state, onUploaded]);

  if (remaining.length === 0) return null;

  return (
    <form
      action={formAction}
      key={slotKey}
      className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="player_id" value={playerId} />
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
        <span className="text-[var(--muted)]">Tambah berkas</span>
        <select name="doc_type" className="input py-1.5 text-sm" required>
          <option value="">Pilih kartu…</option>
          {remaining.map((c) => (
            <option key={c.id} value={c.key}>
              {c.label}
              {c.required ? " (wajib)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
        <span className="text-[var(--muted)]">File</span>
        <input
          ref={fileRef}
          name="file"
          type="file"
          required
          accept="image/*,application/pdf"
          className="input py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary shrink-0 px-3 py-1.5 text-xs"
      >
        {pending ? "…" : "Upload"}
      </button>
      {state.error && (
        <p className="w-full text-xs text-red-300 sm:col-span-full">
          {state.error}
        </p>
      )}
    </form>
  );
}

function DeleteButton({
  teamId,
  playerId,
}: {
  teamId: string;
  playerId: string;
}) {
  const [state, formAction, pending] = useActionState(
    deletePlayerAction,
    {} as ActionState
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="team_id" value={teamId} />
      <input type="hidden" name="player_id" value={playerId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-ghost border border-red-400/40 px-2.5 py-1 text-xs text-red-300"
        onClick={(e) => {
          if (!confirm("Hapus pemain ini beserta berkasnya?")) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "…" : "Hapus"}
      </button>
      {state.error && (
        <span className="ml-1 text-[10px] text-red-300">{state.error}</span>
      )}
    </form>
  );
}

export function PlayersRosterTable({
  teamId,
  players,
  fields,
  docCards,
  minPlayerDocuments,
}: PlayersRosterTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDocId, setAddingDocId] = useState<string | null>(null);
  const labelByKey = Object.fromEntries(docCards.map((c) => [c.key, c.label]));

  if (players.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--muted)]">
        Belum ada pemain terdaftar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-sm sm:min-w-[40rem]">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-3 font-medium">No</th>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">Detail</th>
            <th className="px-4 py-3 font-medium">Berkas</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player, i) => {
            const check = playerDocsSatisfied(
              player.documents,
              docCards,
              minPlayerDocuments
            );
            const extras = fields
              .filter((f) => !isBuiltinPlayerFieldKey(f.key))
              .map((f) => {
                const v = player.extraData[f.key];
                if (!v) return null;
                return `${f.label}: ${formatExtra(v, f.fieldType)}`;
              })
              .filter(Boolean);

            const detailParts = [
              player.jerseyNumber != null ? `#${player.jerseyNumber}` : null,
              player.position,
              player.identityNumber,
              ...extras,
            ].filter(Boolean);

            const uploadedKeys = new Set(player.documents.map((d) => d.docType));
            const remaining = docCards.filter((c) => !uploadedKeys.has(c.key));
            const isEditing = editingId === player.id;
            const isAddingDoc = addingDocId === player.id;

            return (
              <tr key={player.id} className="border-b border-white/5 align-top">
                <td className="px-4 py-3 text-[var(--muted)]">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-white">
                  {player.fullName}
                  {isEditing && (
                    <EditPlayerForm
                      teamId={teamId}
                      player={player}
                      fields={fields}
                      onDone={() => setEditingId(null)}
                    />
                  )}
                  {isAddingDoc && (
                    <AddDocSlot
                      teamId={teamId}
                      playerId={player.id}
                      remaining={remaining}
                      onUploaded={() => {
                        /* revalidate dari server action */
                      }}
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {detailParts.length > 0 ? detailParts.join(" · ") : "—"}
                </td>
                <td className="px-4 py-3">
                  {player.documents.length === 0 ? (
                    <span className="text-[var(--muted)]">—</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {player.documents.map((d) => (
                        <li
                          key={d.id}
                          className="rounded border border-white/15 px-2 py-0.5 text-xs text-white/80"
                        >
                          {labelByKey[d.docType] ?? d.docType}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {check.ok ? (
                    <span className="text-emerald-300">OK</span>
                  ) : (
                    <span className="text-amber-300">
                      {check.have}/{check.needed}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="btn-ghost border border-white/15 px-2.5 py-1 text-xs"
                      onClick={() => {
                        setEditingId(isEditing ? null : player.id);
                        setAddingDocId(null);
                      }}
                    >
                      {isEditing ? "Tutup" : "Edit"}
                    </button>
                    {remaining.length > 0 && (
                      <button
                        type="button"
                        className="btn-ghost border border-white/15 px-2.5 py-1 text-xs"
                        onClick={() => {
                          setAddingDocId(isAddingDoc ? null : player.id);
                          setEditingId(null);
                        }}
                      >
                        {isAddingDoc ? "Tutup" : "Berkas"}
                      </button>
                    )}
                    <DeleteButton teamId={teamId} playerId={player.id} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
