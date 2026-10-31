"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getAdminTeamRoster } from "@/app/actions/admin-roster";
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

export type AdminTeamSummary = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  playerCount: number;
};

type AdminTeamsPlayersListProps = {
  teams: AdminTeamSummary[];
  fields: PlayerFieldDef[];
  docCards: DocCardDef[];
  minPlayerDocuments: number;
  maxPlayersPerTeam: number;
  /** Tim yang dibuka otomatis (opsional) */
  initialOpenTeamId?: string | null;
};

function withDocLabels(
  players: RosterPlayer[],
  labelByKey: Record<string, string>
): RosterPlayer[] {
  return players.map((p) => ({
    ...p,
    documents: p.documents.map((d) => ({
      ...d,
      label: d.label ?? labelByKey[d.docType] ?? d.docType,
    })),
  }));
}

export function AdminTeamsPlayersList({
  teams,
  fields,
  docCards,
  minPlayerDocuments,
  maxPlayersPerTeam,
  initialOpenTeamId = null,
}: AdminTeamsPlayersListProps) {
  const labelByKey = useMemo(
    () => Object.fromEntries(docCards.map((c) => [c.key, c.label])),
    [docCards]
  );

  const [openTeamId, setOpenTeamId] = useState<string | null>(
    initialOpenTeamId
  );
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(teams.map((t) => [t.id, t.playerCount]))
  );
  const [cache, setCache] = useState<Record<string, RosterPlayer[]>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startLoad] = useTransition();
  const prefetching = useRef<Set<string>>(new Set());
  const initialLoaded = useRef(false);

  useEffect(() => {
    setCounts((prev) => {
      const next = { ...prev };
      for (const t of teams) {
        next[t.id] = t.playerCount;
      }
      return next;
    });
  }, [teams]);

  const applyResult = useCallback(
    (teamId: string, players: RosterPlayer[], playerCount: number) => {
      const labeled = withDocLabels(players, labelByKey);
      setCache((prev) => ({ ...prev, [teamId]: labeled }));
      setCounts((prev) => ({ ...prev, [teamId]: playerCount }));
    },
    [labelByKey]
  );

  const fetchRoster = useCallback(
    (teamId: string, opts?: { force?: boolean; silent?: boolean }) => {
      const force = opts?.force ?? false;
      const silent = opts?.silent ?? false;

      if (!force && cache[teamId]) {
        return;
      }

      if (!silent) {
        setLoadError(null);
        setLoadingId(teamId);
      }

      startLoad(async () => {
        const result = await getAdminTeamRoster(teamId);
        if (!silent) setLoadingId((cur) => (cur === teamId ? null : cur));

        if (!result.ok) {
          if (!silent) setLoadError(result.error);
          return;
        }
        applyResult(teamId, result.players, result.playerCount);
      });
    },
    [applyResult, cache]
  );

  const prefetch = useCallback(
    (teamId: string) => {
      if (cache[teamId] || prefetching.current.has(teamId)) return;
      prefetching.current.add(teamId);
      void getAdminTeamRoster(teamId).then((result) => {
        prefetching.current.delete(teamId);
        if (!result.ok) return;
        applyResult(teamId, result.players, result.playerCount);
      });
    },
    [applyResult, cache]
  );

  useEffect(() => {
    if (initialLoaded.current) return;
    if (!initialOpenTeamId) return;
    if (!teams.some((t) => t.id === initialOpenTeamId)) return;
    initialLoaded.current = true;
    setOpenTeamId(initialOpenTeamId);
    fetchRoster(initialOpenTeamId, { force: true });
  }, [initialOpenTeamId, teams, fetchRoster]);

  function toggle(teamId: string) {
    if (openTeamId === teamId) {
      setOpenTeamId(null);
      setLoadError(null);
      setLoadingId(null);
      return;
    }
    setOpenTeamId(teamId);
    setLoadError(null);
    if (cache[teamId]) {
      // Langsung tampil dari cache; refresh diam di background
      setLoadingId(null);
      fetchRoster(teamId, { force: true, silent: true });
      return;
    }
    fetchRoster(teamId, { force: true });
  }

  const openRoster = openTeamId ? cache[openTeamId] : undefined;
  const openLoading = openTeamId != null && loadingId === openTeamId && !openRoster;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs text-[var(--muted)]">
        Data pemain dimuat saat tim dibuka (dan di-cache). Hanya satu tim
        terbuka — admin dapat kelola tanpa batasan jadwal.
      </p>

      {teams.map((team) => {
        const open = openTeamId === team.id;
        const panelId = `tim-detail-${team.id}`;
        const playerCount = counts[team.id] ?? team.playerCount;
        const canAdd = playerCount < maxPlayersPerTeam;

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
              onMouseEnter={() => prefetch(team.id)}
              onFocus={() => prefetch(team.id)}
            >
              <div className="min-w-0">
                <h2 className="font-semibold text-white">{team.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {TEAM_STATUS_LABEL[team.status] ?? team.status} ·{" "}
                  {playerCount} / {maxPlayersPerTeam} pemain
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
                      documentsOptional
                      onSaved={() =>
                        fetchRoster(team.id, { force: true })
                      }
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
                      {loadingId === team.id && openRoster
                        ? " · memperbarui…"
                        : ""}
                    </p>
                  </div>
                  {openLoading ? (
                    <p className="px-4 py-6 text-sm text-[var(--muted)]">
                      Memuat data pemain…
                    </p>
                  ) : loadError ? (
                    <div className="px-4 py-6">
                      <p className="text-sm text-red-300">{loadError}</p>
                      <button
                        type="button"
                        className="btn-ghost mt-3 border border-white/15 px-3 py-1.5 text-xs"
                        onClick={() =>
                          fetchRoster(team.id, { force: true })
                        }
                      >
                        Coba lagi
                      </button>
                    </div>
                  ) : (
                    <PlayersRosterTable
                      teamId={team.id}
                      players={openRoster ?? []}
                      fields={fields}
                      docCards={docCards}
                      minPlayerDocuments={minPlayerDocuments}
                      locked={false}
                      onChanged={() =>
                        fetchRoster(team.id, { force: true })
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
