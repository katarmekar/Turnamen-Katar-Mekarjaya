"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteTournament, selectTournament } from "@/app/actions/admin";

export type TournamentPickItem = {
  id: string;
  name: string;
  status: string;
  formatLabel: string;
  feeLabel: string;
  teamCount: number;
  maxTeams: number;
};

type TournamentPickListProps = {
  tournaments: TournamentPickItem[];
  selectedId: string | null;
};

export function TournamentPickList({
  tournaments,
  selectedId,
}: TournamentPickListProps) {
  const router = useRouter();
  const [pendingSelect, startSelect] = useTransition();
  const [pendingDelete, startDelete] = useTransition();
  const [deleting, setDeleting] = useState<TournamentPickItem | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openDelete(t: TournamentPickItem) {
    setDeleting(t);
    setConfirmName("");
    setError(null);
  }

  function closeDelete() {
    if (pendingDelete) return;
    setDeleting(null);
    setConfirmName("");
    setError(null);
  }

  function handleSelect(tournamentId: string) {
    const fd = new FormData();
    fd.set("tournament_id", tournamentId);
    startSelect(() => {
      selectTournament(fd);
    });
  }

  function handleConfirmDelete(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deleting) return;

    const fd = new FormData();
    fd.set("tournament_id", deleting.id);
    fd.set("confirm_name", confirmName.trim());

    startDelete(async () => {
      setError(null);
      const result = await deleteTournament({}, fd);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDeleting(null);
      setConfirmName("");
      router.refresh();
    });
  }

  const nameMatches =
    deleting != null && confirmName.trim() === deleting.name;

  return (
    <>
      <div className="mt-6 space-y-3">
        {tournaments.map((t) => {
          const isActive = t.id === selectedId;
          return (
            <div
              key={t.id}
              className={`panel flex flex-wrap items-center justify-between gap-3 p-4 ${
                isActive ? "border-[var(--accent)]/50" : ""
              }`}
            >
              <div>
                <p className="font-medium text-white">
                  {t.name}
                  {isActive ? (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                      aktif
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {t.status} · {t.formatLabel} · {t.feeLabel} · {t.teamCount}{" "}
                  tim · max {t.maxTeams}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={pendingSelect || pendingDelete}
                  onClick={() => handleSelect(t.id)}
                >
                  {isActive ? "Buka panel" : "Pilih"}
                </button>
                <button
                  type="button"
                  className="btn-ghost border border-red-400/40 text-red-300"
                  disabled={pendingDelete}
                  onClick={() => openDelete(t)}
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {deleting && (
        <div
          className="success-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-tournament-title"
        >
          <button
            type="button"
            className="success-backdrop"
            aria-label="Tutup"
            onClick={closeDelete}
          />
          <div className="success-dialog panel max-w-md">
            <h2
              id="delete-tournament-title"
              className="text-xl font-semibold text-white"
            >
              Hapus turnamen?
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Semua data terkait (tim, pembayaran, bagan, jadwal) akan ikut
              terhapus dan tidak bisa dikembalikan.
            </p>
            <p className="mt-3 text-sm text-white">
              Ketik nama turnamen{" "}
              <strong className="text-amber-300">{deleting.name}</strong> untuk
              konfirmasi.
            </p>
            <form onSubmit={handleConfirmDelete} className="mt-4 space-y-3">
              <input
                className="input w-full"
                placeholder={deleting.name}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoFocus
                autoComplete="off"
                disabled={pendingDelete}
              />
              {error && (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="btn-ghost border border-white/15"
                  disabled={pendingDelete}
                  onClick={closeDelete}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-ghost border border-red-400/50 bg-red-500/15 text-red-200 disabled:opacity-40"
                  disabled={!nameMatches || pendingDelete}
                >
                  {pendingDelete ? "Menghapus..." : "Ya, hapus turnamen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
