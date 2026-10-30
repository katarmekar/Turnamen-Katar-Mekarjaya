"use client";

import { useMemo, useState } from "react";
import {
  AddPlayerForm,
  type DocCardDef,
  type PlayerFieldDef,
} from "@/components/add-player-form";
import {
  PlayersRosterTable,
  type RosterPlayer,
} from "@/components/players-roster-table";
import { TEAM_STATUS_LABEL } from "@/lib/format";

export type AdminTeamPlayersView = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  players: RosterPlayer[];
};

type AdminTeamsPlayersListProps = {
  teams: AdminTeamPlayersView[];
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
  maxPlayersPerTeam: number;
  /** Tim yang dibuka otomatis (opsional) */
  initialOpenTeamId?: string | null;
};

export function AdminTeamsPlayersList({
  teams,
  fields,
  docCards,
  minPlayerDocuments,
  maxPlayersPerTeam,
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          Admin dapat menambah, mengubah, dan menghapus data pemain tanpa
          batasan jadwal pertandingan.
        </p>
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
        const canAdd = team.players.length < maxPlayersPerTeam;

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
                  {team.players.length} / {maxPlayersPerTeam} pemain
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
                  {open ? "Sembunyikan ▲" : "Kelola ▼"}
                </span>
              </div>
            </button>

            {open && (
              <div id={panelId} className="border-t border-white/10">
                <div className="border-b border-white/10 px-5 py-5">
                  <h3 className="text-sm font-semibold text-white">
                    Tambah pemain
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Form sama seperti manajer; perubahan admin tidak dikunci
                    jadwal.
                  </p>
                  <div className="mt-4">
                    <AddPlayerForm
                      teamId={team.id}
                      fields={fields}
                      docCards={docCards}
                      minPlayerDocuments={minPlayerDocuments}
                      canAdd={canAdd}
                    />
                  </div>
                </div>

                <div className="px-1 py-2 sm:px-2">
                  <div className="border-b border-white/10 px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">
                      Daftar pemain
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Edit data, tambah berkas, atau hapus pemain.
                    </p>
                  </div>
                  <PlayersRosterTable
                    teamId={team.id}
                    players={team.players}
                    fields={fields}
                    docCards={docCards}
                    minPlayerDocuments={minPlayerDocuments}
                    locked={false}
                  />
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
