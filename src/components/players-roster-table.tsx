"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { getPlayerMediaSignedUrl } from "@/app/actions/player-media";
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
  /** true jika ada foto di storage (URL di-fetch on-demand) */
  hasPhoto?: boolean;
  /** opsional cache URL; biasanya null agar load halaman cepat */
  photoUrl: string | null;
  extraData: Record<string, string>;
  documents: {
    id: string;
    docType: string;
    url?: string | null;
    label?: string;
  }[];
};

type PlayersRosterTableProps = {
  teamId: string;
  players: RosterPlayer[];
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
  locked?: boolean;
};

type PreviewTarget = {
  title: string;
  teamId: string;
  playerId: string;
  kind: "photo" | "document";
  documentId?: string;
};

function previewKind(url: string): "image" | "pdf" | "other" {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(jpe?g|png|webp|gif|bmp)$/i.test(path)) return "image";
  if (/\.pdf$/i.test(path)) return "pdf";
  return "other";
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const ZOOM_STEP = 0.25;

function FilePreviewModal({
  target,
  onClose,
}: {
  target: PreviewTarget;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asPdf, setAsPdf] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setUrl(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setAsPdf(false);

    void (async () => {
      const result = await getPlayerMediaSignedUrl({
        teamId: target.teamId,
        playerId: target.playerId,
        kind: target.kind,
        documentId: target.documentId,
      });
      if (cancelled) return;
      if (result.error || !result.url) {
        setLoadError(result.error ?? "Gagal memuat berkas.");
        setLoading(false);
        return;
      }
      setUrl(result.url);
      setAsPdf(previewKind(result.url) === "pdf");
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [target]);

  function clampZoom(value: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
  }

  function zoomBy(delta: number) {
    setZoom((prev) => {
      const next = clampZoom(prev + delta);
      if (next <= ZOOM_MIN) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function resetZoom() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (asPdf || !url) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(-ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        resetZoom();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, asPdf, url]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={target.title}
      onClick={onClose}
    >
      <div
        className="panel relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h3 className="min-w-0 truncate font-semibold text-white">
            {target.title}
          </h3>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!asPdf && url && (
              <div className="flex items-center gap-1 rounded-md border border-white/15 bg-black/20 p-0.5">
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-40"
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() => zoomBy(-ZOOM_STEP)}
                  title="Perkecil (−)"
                >
                  −
                </button>
                <button
                  type="button"
                  className="btn-ghost min-w-14 px-2 py-1 text-xs tabular-nums"
                  onClick={resetZoom}
                  title="Reset zoom (0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  className="btn-ghost px-2.5 py-1 text-xs disabled:opacity-40"
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() => zoomBy(ZOOM_STEP)}
                  title="Perbesar (+)"
                >
                  +
                </button>
              </div>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost border border-white/15 px-2.5 py-1 text-xs"
              >
                Buka tab baru
              </a>
            )}
            <button
              type="button"
              className="btn-ghost border border-white/15 px-2.5 py-1 text-xs"
              onClick={onClose}
            >
              Tutup
            </button>
          </div>
        </div>
        <div
          className={`relative min-h-0 flex-1 overflow-hidden bg-black/40 ${
            asPdf || !url
              ? ""
              : zoom > 1
                ? "cursor-grab active:cursor-grabbing"
                : "cursor-zoom-in"
          }`}
          onWheel={(e) => {
            if (asPdf || !url) return;
            e.preventDefault();
            zoomBy(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
          }}
          onPointerDown={(e) => {
            if (asPdf || !url || zoom <= 1) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragRef.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              originX: offset.x,
              originY: offset.y,
            };
          }}
          onPointerMove={(e) => {
            const drag = dragRef.current;
            if (!drag.active) return;
            setOffset({
              x: drag.originX + (e.clientX - drag.startX),
              y: drag.originY + (e.clientY - drag.startY),
            });
          }}
          onPointerUp={() => {
            dragRef.current.active = false;
          }}
          onPointerCancel={() => {
            dragRef.current.active = false;
          }}
          onDoubleClick={() => {
            if (asPdf || !url) return;
            if (zoom > 1) resetZoom();
            else zoomBy(1);
          }}
        >
          {loading ? (
            <div className="flex h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
              Memuat preview…
            </div>
          ) : loadError ? (
            <div className="flex h-[40vh] items-center justify-center px-4 text-sm text-red-300">
              {loadError}
            </div>
          ) : asPdf && url ? (
            <iframe
              title={target.title}
              src={url}
              className="h-[75vh] w-full rounded-md border border-white/10 bg-white"
            />
          ) : url ? (
            <div className="flex h-[75vh] items-center justify-center p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={target.title}
                draggable={false}
                className="max-h-full max-w-full select-none rounded-md object-contain transition-transform duration-150"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
                onError={() => setAsPdf(true)}
              />
            </div>
          ) : null}
        </div>
        {!asPdf && url && (
          <p className="border-t border-white/10 px-4 py-2 text-center text-[11px] text-[var(--muted)]">
            Scroll / tombol +− untuk zoom · seret saat diperbesar · dobel-klik
            untuk reset
          </p>
        )}
      </div>
    </div>
  );
}

function LazyPlayerPhoto({
  teamId,
  playerId,
  fullName,
  hasPhoto,
  cachedUrl,
  onPreview,
}: {
  teamId: string;
  playerId: string;
  fullName: string;
  hasPhoto: boolean;
  cachedUrl: string | null;
  onPreview: () => void;
}) {
  const [url, setUrl] = useState<string | null>(cachedUrl);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!hasPhoto || url) return;
    let cancelled = false;
    setPending(true);
    void getPlayerMediaSignedUrl({
      teamId,
      playerId,
      kind: "photo",
    }).then((result) => {
      if (cancelled) return;
      setPending(false);
      if (result.url) setUrl(result.url);
    });
    return () => {
      cancelled = true;
    };
  }, [hasPhoto, url, teamId, playerId]);

  if (!hasPhoto) {
    return (
      <span className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 text-[10px] text-[var(--muted)]">
        —
      </span>
    );
  }

  if (!url) {
    return (
      <span className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 text-[10px] text-[var(--muted)]">
        {pending ? "…" : "Foto"}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="rounded-md ring-[var(--accent)]/0 transition hover:ring-2 hover:ring-[var(--accent)]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      title="Preview foto"
      onClick={onPreview}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={fullName}
        className="size-10 rounded-md object-cover"
      />
    </button>
  );
}

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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updatePlayer,
    {} as ActionState
  );

  useEffect(() => {
    if (!state.success) return;
    onDone();
    router.refresh();
  }, [state.success, onDone, router]);

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
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-[var(--muted)]">
            Foto pemain (opsional)
            {player.hasPhoto || player.photoUrl ? " — ganti jika perlu" : ""}
          </span>
          <input
            name="photo"
            type="file"
            accept="image/*"
            className="input py-1.5"
          />
        </label>
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
  const router = useRouter();
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
    router.refresh();
  }, [state, onUploaded, router]);

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
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    deletePlayerAction,
    {} as ActionState
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

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
  locked = false,
}: PlayersRosterTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingDocId, setAddingDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
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
      {preview && (
        <FilePreviewModal
          target={preview}
          onClose={() => setPreview(null)}
        />
      )}
      <table className="w-full min-w-[28rem] border-collapse text-sm sm:min-w-[40rem]">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-3 font-medium">No</th>
            <th className="px-4 py-3 font-medium">Foto</th>
            <th className="px-4 py-3 font-medium">Nama</th>
            <th className="px-4 py-3 font-medium">Detail</th>
            <th className="px-4 py-3 font-medium">Berkas</th>
            <th className="px-4 py-3 font-medium">Status</th>
            {!locked && <th className="px-4 py-3 font-medium">Aksi</th>}
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
                <td className="px-4 py-3">
                  <LazyPlayerPhoto
                    teamId={teamId}
                    playerId={player.id}
                    fullName={player.fullName}
                    hasPhoto={Boolean(player.hasPhoto || player.photoUrl)}
                    cachedUrl={player.photoUrl}
                    onPreview={() =>
                      setPreview({
                        title: `Foto — ${player.fullName}`,
                        teamId,
                        playerId: player.id,
                        kind: "photo",
                      })
                    }
                  />
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {player.fullName}
                  {!locked && isEditing && (
                    <EditPlayerForm
                      teamId={teamId}
                      player={player}
                      fields={fields}
                      onDone={() => setEditingId(null)}
                    />
                  )}
                  {!locked && isAddingDoc && (
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
                      {player.documents.map((d) => {
                        const label =
                          d.label ?? labelByKey[d.docType] ?? d.docType;
                        return (
                          <li key={d.id}>
                            <button
                              type="button"
                              className="rounded border border-white/15 px-2 py-0.5 text-xs text-[var(--accent)] underline-offset-2 transition hover:border-[var(--accent)]/50 hover:underline"
                              title={`Preview ${label}`}
                              onClick={() =>
                                setPreview({
                                  title: `${label} — ${player.fullName}`,
                                  teamId,
                                  playerId: player.id,
                                  kind: "document",
                                  documentId: d.id,
                                })
                              }
                            >
                              {label}
                            </button>
                          </li>
                        );
                      })}
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
                {!locked && (
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
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
