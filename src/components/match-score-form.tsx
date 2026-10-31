"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form-status";
import { submitScore } from "@/app/actions/admin";

export type RosterPlayerOption = {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
};

export type MatchEventDraft = {
  type: "goal" | "yellow_card" | "red_card";
  teamId: string;
  playerId: string;
};

type MatchScoreFormProps = {
  matchId: string;
  isRr: boolean;
  teamA: { id: string; name: string; players: RosterPlayerOption[] };
  teamB: { id: string; name: string; players: RosterPlayerOption[] };
  initial: {
    resultType: "score" | "wo" | "dq";
    winnerTeamId: string;
    scoreA: number | null;
    scoreB: number | null;
    forfeitedTeamId: string;
    notes: string;
    events: MatchEventDraft[];
  };
  isEdit: boolean;
};

function playerLabel(p: RosterPlayerOption) {
  const no = p.jerseyNumber != null ? `#${p.jerseyNumber} ` : "";
  return `${no}${p.fullName}`;
}

function EventRows({
  title,
  type,
  rows,
  teamA,
  teamB,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  type: MatchEventDraft["type"];
  rows: MatchEventDraft[];
  teamA: MatchScoreFormProps["teamA"];
  teamB: MatchScoreFormProps["teamB"];
  onChange: (index: number, next: MatchEventDraft) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const typed = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.type === type);

  return (
    <div className="space-y-2 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">{title}</p>
        <button
          type="button"
          className="btn-ghost border border-white/15 px-2 py-1 text-xs"
          onClick={onAdd}
        >
          + Tambah
        </button>
      </div>
      {typed.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">Belum ada entri.</p>
      ) : (
        typed.map(({ row, index }) => {
          const players =
            row.teamId === teamA.id
              ? teamA.players
              : row.teamId === teamB.id
                ? teamB.players
                : [];
          return (
            <div
              key={`${type}-${index}`}
              className="grid gap-2 rounded-md border border-white/10 p-2 sm:grid-cols-[1fr_1.4fr_auto]"
            >
              <select
                className="input"
                value={row.teamId}
                onChange={(e) => {
                  const teamId = e.target.value;
                  onChange(index, {
                    ...row,
                    teamId,
                    playerId: "",
                  });
                }}
              >
                <option value={teamA.id}>{teamA.name}</option>
                <option value={teamB.id}>{teamB.name}</option>
              </select>
              <select
                className="input"
                value={row.playerId}
                onChange={(e) =>
                  onChange(index, { ...row, playerId: e.target.value })
                }
                required
              >
                <option value="">Pilih pemain…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {playerLabel(p)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost border border-white/15 px-2 text-xs text-red-300"
                onClick={() => onRemove(index)}
              >
                Hapus
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export function MatchScoreForm({
  matchId,
  isRr,
  teamA,
  teamB,
  initial,
  isEdit,
}: MatchScoreFormProps) {
  const [events, setEvents] = useState<MatchEventDraft[]>(initial.events);

  function addEvent(type: MatchEventDraft["type"]) {
    setEvents((prev) => [
      ...prev,
      { type, teamId: teamA.id, playerId: "" },
    ]);
  }

  function updateEvent(index: number, next: MatchEventDraft) {
    setEvents((prev) => prev.map((row, i) => (i === index ? next : row)));
  }

  function removeEvent(index: number) {
    setEvents((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <ActionForm
      action={submitScore}
      className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
    >
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="events_json" value={JSON.stringify(events)} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Tipe hasil</span>
        <select
          name="result_type"
          className="input"
          defaultValue={initial.resultType}
        >
          <option value="score">Skor</option>
          <option value="wo">WO</option>
          <option value="dq">Diskualifikasi</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">
          Pemenang{isRr ? " (kosong = seri)" : ""}
        </span>
        <select
          name="winner_team_id"
          className="input"
          required={!isRr}
          defaultValue={initial.winnerTeamId}
        >
          {isRr && <option value="">Seri / belum pilih</option>}
          <option value={teamA.id}>{teamA.name}</option>
          <option value={teamB.id}>{teamB.name}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Skor {teamA.name}</span>
        <input
          name="score_a"
          type="number"
          min={0}
          className="input"
          defaultValue={initial.scoreA ?? ""}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--muted)]">Skor {teamB.name}</span>
        <input
          name="score_b"
          type="number"
          min={0}
          className="input"
          defaultValue={initial.scoreB ?? ""}
        />
      </label>

      <EventRows
        title="Pencetak gol"
        type="goal"
        rows={events}
        teamA={teamA}
        teamB={teamB}
        onChange={updateEvent}
        onAdd={() => addEvent("goal")}
        onRemove={removeEvent}
      />
      <EventRows
        title="Kartu kuning"
        type="yellow_card"
        rows={events}
        teamA={teamA}
        teamB={teamB}
        onChange={updateEvent}
        onAdd={() => addEvent("yellow_card")}
        onRemove={removeEvent}
      />
      <EventRows
        title="Kartu merah"
        type="red_card"
        rows={events}
        teamA={teamA}
        teamB={teamB}
        onChange={updateEvent}
        onAdd={() => addEvent("red_card")}
        onRemove={removeEvent}
      />

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">Tim WO/DQ (opsional)</span>
        <select
          name="forfeited_team_id"
          className="input"
          defaultValue={initial.forfeitedTeamId}
        >
          <option value="">—</option>
          <option value={teamA.id}>{teamA.name}</option>
          <option value={teamB.id}>{teamB.name}</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-[var(--muted)]">Catatan</span>
        <input
          name="notes"
          className="input"
          defaultValue={initial.notes}
        />
      </label>
      <button type="submit" className="btn-primary sm:col-span-2">
        {isEdit ? "Simpan perubahan hasil" : "Simpan hasil"}
      </button>
    </ActionForm>
  );
}
