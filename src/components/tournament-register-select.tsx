"use client";

import { useMemo, useState } from "react";

export type OpenTournamentOption = {
  id: string;
  name: string;
  feeLabel: string;
  maxTeams: number;
  confirmedCount: number;
  formatLabel: string;
  slotsLeft: number;
};

type TournamentRegisterSelectProps = {
  tournaments: OpenTournamentOption[];
  defaultId?: string;
};

export function TournamentRegisterSelect({
  tournaments,
  defaultId,
}: TournamentRegisterSelectProps) {
  const initial =
    defaultId && tournaments.some((t) => t.id === defaultId)
      ? defaultId
      : (tournaments[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState(initial);

  const selected = useMemo(
    () => tournaments.find((t) => t.id === selectedId) ?? tournaments[0],
    [tournaments, selectedId]
  );

  if (tournaments.length === 0) return null;

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[var(--muted)]">Pilih turnamen *</span>
        <select
          name="tournament_id"
          required
          className="input"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id} disabled={t.slotsLeft <= 0}>
              {t.name}
              {t.slotsLeft <= 0 ? " (penuh)" : ""}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 text-sm">
          <p className="font-medium text-white">{selected.name}</p>
          <p className="mt-1 text-[var(--muted)]">
            {selected.formatLabel} · Biaya {selected.feeLabel}
          </p>
          <p className="mt-1 text-[var(--muted)]">
            Slot {selected.confirmedCount}/{selected.maxTeams} terisi
            {selected.slotsLeft > 0
              ? ` · sisa ${selected.slotsLeft}`
              : " · penuh"}
          </p>
        </div>
      )}
    </div>
  );
}
