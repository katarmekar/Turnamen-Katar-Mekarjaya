"use client";

import { useMemo, useState } from "react";
import { TEAM_STATUS_LABEL } from "@/lib/format";

export type AdminPlayerDocView = {
  id: string;
  docType: string;
  label: string;
  url: string | null;
};

export type AdminPlayerView = {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
  identityNumber: string | null;
  photoUrl: string | null;
  documents: AdminPlayerDocView[];
};

export type AdminTeamPlayersView = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  players: AdminPlayerView[];
};

type AdminTeamsPlayersListProps = {
  teams: AdminTeamPlayersView[];
  /** Tim yang dibuka otomatis (opsional) */
  initialOpenTeamId?: string | null;
};

export function AdminTeamsPlayersList({
  teams,
  initialOpenTeamId = null,
}: AdminTeamsPlayersListProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    initialOpenTeamId ? new Set([initialOpenTeamId]) : new Set()
  );

  const allOpen = useMemo(
    () => teams.length > 0 && teams.every((t) => openIds.has(t.id)),
    [teams, openIds]
  );

  function toggle(teamId: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function setAll(open: boolean) {
    setOpenIds(open ? new Set(teams.map((t) => t.id)) : new Set());
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn-ghost border border-white/15 px-3 py-1.5 text-xs"
          onClick={() => setAll(!allOpen)}
        >
          {allOpen ? "Tutup semua detail" : "Buka semua detail"}
        </button>
      </div>

      {teams.map((team) => {
        const open = openIds.has(team.id);
        const panelId = `tim-detail-${team.id}`;

        return (
          <section
            key={team.id}
            id={`tim-${team.id}`}
            className={`panel scroll-mt-8 overflow-hidden ${
              initialOpenTeamId === team.id
                ? "ring-1 ring-[var(--accent)]/50"
                : ""
            }`}
          >
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => toggle(team.id)}
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{team.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {TEAM_STATUS_LABEL[team.status] ?? team.status} ·{" "}
                  {team.players.length} pemain
                  {team.city ? ` · ${team.city}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {team.status !== "confirmed" && (
                  <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                    Belum confirmed
                  </span>
                )}
                <span className="rounded border border-white/15 px-2.5 py-1 text-xs text-[var(--muted)]">
                  {open ? "Sembunyikan ▲" : "Lihat detail ▼"}
                </span>
              </div>
            </button>

            {open && (
              <div id={panelId} className="border-t border-white/10">
                {team.players.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-[var(--muted)]">
                    Belum ada pemain pada tim ini.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[32rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                          <th className="px-5 py-3 font-medium">No</th>
                          <th className="px-5 py-3 font-medium">Foto</th>
                          <th className="px-5 py-3 font-medium">Nama</th>
                          <th className="px-5 py-3 font-medium">Detail</th>
                          <th className="px-5 py-3 font-medium">Berkas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.players.map((player, i) => {
                          const detail = [
                            player.jerseyNumber != null
                              ? `#${player.jerseyNumber}`
                              : null,
                            player.position,
                            player.identityNumber,
                          ]
                            .filter(Boolean)
                            .join(" · ");

                          return (
                            <tr
                              key={player.id}
                              className="border-b border-white/5 last:border-0 align-top"
                            >
                              <td className="px-5 py-3 text-[var(--muted)]">
                                {i + 1}
                              </td>
                              <td className="px-5 py-3">
                                {player.photoUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={player.photoUrl}
                                    alt={player.fullName}
                                    className="size-10 rounded-md object-cover"
                                  />
                                ) : (
                                  <span className="inline-flex size-10 items-center justify-center rounded-md border border-white/10 text-[10px] text-[var(--muted)]">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3 font-medium text-white">
                                {player.fullName}
                              </td>
                              <td className="px-5 py-3 text-[var(--muted)]">
                                {detail || "—"}
                              </td>
                              <td className="px-5 py-3">
                                {player.documents.length === 0 ? (
                                  <span className="text-[var(--muted)]">
                                    Belum ada berkas
                                  </span>
                                ) : (
                                  <ul className="flex flex-col gap-1.5">
                                    {player.documents.map((doc) => (
                                      <li key={doc.id}>
                                        {doc.url ? (
                                          <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[var(--accent)] underline-offset-2 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {doc.label}
                                          </a>
                                        ) : (
                                          <span className="text-[var(--muted)]">
                                            {doc.label} (tidak bisa dibuka)
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
