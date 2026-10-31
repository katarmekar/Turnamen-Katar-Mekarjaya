"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form-status";
import {
  MatchScoreForm,
  type MatchEventDraft,
  type RosterPlayerOption,
} from "@/components/match-score-form";
import { updateMatchSchedule } from "@/app/actions/admin";
import { RESULT_TYPE_LABEL } from "@/lib/format";

export type AdminJadwalMatchCard = {
  id: string;
  phaseLabel: string;
  notes: string | null;
  nameA: string;
  nameB: string;
  scheduledAtLocal: string;
  scheduledAtLabel: string;
  venue: string;
  bothReady: boolean;
  bothBye: boolean;
  hasTbd: boolean;
  canManageScore: boolean;
  showSchedule: boolean;
  isRr: boolean;
  resultType: "score" | "wo" | "dq" | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  winnerName: string | null;
  forfeitedTeamId: string | null;
  goalsLabel: string | null;
  yellowsLabel: string | null;
  redsLabel: string | null;
  teamA: { id: string; name: string; players: RosterPlayerOption[] } | null;
  teamB: { id: string; name: string; players: RosterPlayerOption[] } | null;
  events: MatchEventDraft[];
};

type AdminJadwalMatchListProps = {
  matches: AdminJadwalMatchCard[];
};

export function AdminJadwalMatchList({ matches }: AdminJadwalMatchListProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }

  return (
    <div className="mt-6 space-y-3">
      {matches.map((m) => {
        const open = openId === m.id;
        const scoreLine =
          m.resultType != null
            ? `${RESULT_TYPE_LABEL[m.resultType]}${
                m.scoreA != null && m.scoreB != null
                  ? ` ${m.scoreA}-${m.scoreB}`
                  : ""
              }`
            : null;

        return (
          <div key={m.id} className="panel overflow-hidden">
            <button
              type="button"
              className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5"
              aria-expanded={open}
              onClick={() => toggle(m.id)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {m.phaseLabel}
                  {m.scheduledAtLabel ? ` · ${m.scheduledAtLabel}` : ""}
                  {m.venue ? ` · ${m.venue}` : ""}
                </p>
                <p className="mt-1 text-base font-medium text-white sm:text-lg">
                  {m.nameA}{" "}
                  <span className="text-[var(--muted)]">vs</span> {m.nameB}
                </p>
                {scoreLine ? (
                  <p className="mt-1 text-sm text-emerald-300">
                    {scoreLine}
                    {m.winnerName ? ` · ${m.winnerName}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {m.bothBye
                      ? "Slot BYE"
                      : m.hasTbd
                        ? "Menunggu pemenang babak sebelumnya"
                        : m.scheduledAtLabel
                          ? "Belum ada hasil"
                          : "Jadwal belum diisi"}
                  </p>
                )}
              </div>
              <span className="shrink-0 pt-1 text-sm text-[var(--muted)]">
                {open ? "▲" : "▼"}
              </span>
            </button>

            {open && (
              <div className="border-t border-white/10 px-4 pb-5 pt-2 sm:px-5">
                {m.resultType ? (
                  <div className="mb-2 space-y-1 text-sm text-emerald-300">
                    <p>
                      Hasil: {RESULT_TYPE_LABEL[m.resultType]}{" "}
                      {m.scoreA != null && m.scoreB != null
                        ? `${m.scoreA}-${m.scoreB}`
                        : ""}{" "}
                      · Pemenang: {m.winnerName ?? "—"}
                    </p>
                    {m.goalsLabel && (
                      <p className="text-[var(--muted)]">Gol: {m.goalsLabel}</p>
                    )}
                    {m.yellowsLabel && (
                      <p className="text-amber-200/90">
                        Kuning: {m.yellowsLabel}
                      </p>
                    )}
                    {m.redsLabel && (
                      <p className="text-red-300">Merah: {m.redsLabel}</p>
                    )}
                    <p className="text-xs text-[var(--muted)]">
                      Admin dapat mengubah hasil, gol, dan kartu di bawah.
                    </p>
                  </div>
                ) : null}

                {m.bothBye ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Slot BYE — tidak perlu dijadwalkan.
                  </p>
                ) : m.hasTbd ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Menunggu pemenang babak sebelumnya.
                  </p>
                ) : (
                  <>
                    {m.showSchedule && (
                      <ActionForm
                        action={updateMatchSchedule}
                        className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <input type="hidden" name="match_id" value={m.id} />
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                          <span className="text-[var(--muted)]">Jadwal</span>
                          <input
                            type="datetime-local"
                            name="scheduled_at"
                            className="input"
                            defaultValue={m.scheduledAtLocal}
                          />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                          <span className="text-[var(--muted)]">Venue</span>
                          <input
                            name="venue"
                            className="input"
                            defaultValue={m.venue}
                          />
                        </label>
                        <button
                          type="submit"
                          className="btn-ghost w-full border border-white/15 sm:w-auto"
                        >
                          Simpan jadwal
                        </button>
                      </ActionForm>
                    )}

                    {m.canManageScore && m.teamA && m.teamB && (
                      <MatchScoreForm
                        matchId={m.id}
                        isRr={m.isRr}
                        isEdit={Boolean(m.resultType)}
                        teamA={m.teamA}
                        teamB={m.teamB}
                        initial={{
                          resultType: m.resultType ?? "score",
                          winnerTeamId: m.winnerTeamId ?? "",
                          scoreA: m.scoreA,
                          scoreB: m.scoreB,
                          forfeitedTeamId: m.forfeitedTeamId ?? "",
                          notes: m.notes ?? "",
                          events: m.events,
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
