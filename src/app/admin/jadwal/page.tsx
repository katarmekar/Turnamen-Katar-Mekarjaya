import { AdminPageShell } from "@/components/admin-page-shell";
import { ActionForm } from "@/components/action-form-status";
import { MatchScoreForm } from "@/components/match-score-form";
import { updateMatchSchedule } from "@/app/actions/admin";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { RESULT_TYPE_LABEL } from "@/lib/format";
import { groupLetter, isLeagueFormat } from "@/lib/league";
import { prisma } from "@/lib/prisma";

export default async function AdminJadwalPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const matches = await prisma.match.findMany({
    where: { tournamentId: tournament.id },
    include: {
      slotA: {
        include: {
          team: {
            include: {
              players: {
                select: {
                  id: true,
                  fullName: true,
                  jerseyNumber: true,
                },
                orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
              },
            },
          },
        },
      },
      slotB: {
        include: {
          team: {
            include: {
              players: {
                select: {
                  id: true,
                  fullName: true,
                  jerseyNumber: true,
                },
                orderBy: [{ jerseyNumber: "asc" }, { fullName: "asc" }],
              },
            },
          },
        },
      },
      winnerTeam: true,
      events: {
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
        include: {
          player: { select: { id: true, fullName: true, jerseyNumber: true } },
        },
      },
    },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });

  return (
    <AdminPageShell
      profile={profile}
      title="Jadwal & skor"
      description={tournament.name}
    >
      {matches.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Belum ada pertandingan. Buat bagan / jadwal dulu di menu Acak bagan.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {matches.map((m) => {
            const isRr = isLeagueFormat(tournament.competitionFormat);
            const nameA = m.slotA.isBye
              ? "BYE"
              : (m.slotA.team?.name ?? "TBD");
            const nameB = m.slotB.isBye
              ? "BYE"
              : (m.slotB.team?.name ?? "TBD");
            const phaseLabel =
              m.groupIndex != null
                ? `Grup ${groupLetter(m.groupIndex)}`
                : m.round >= 10
                  ? "Fase gugur"
                  : `Round ${m.round}`;
            const bothReady = Boolean(m.slotA.teamId && m.slotB.teamId);
            const bothBye = m.slotA.isBye && m.slotB.isBye;
            const hasTbd =
              (!m.slotA.teamId && !m.slotA.isBye) ||
              (!m.slotB.teamId && !m.slotB.isBye);
            const canManageScore =
              bothReady && !m.slotA.isBye && !m.slotB.isBye;
            const showSchedule = bothReady;

            const toLocal = (d: Date | null) => {
              if (!d) return "";
              const pad = (n: number) => String(n).padStart(2, "0");
              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            const goals = m.events.filter((e) => e.type === "goal");
            const yellows = m.events.filter((e) => e.type === "yellow_card");
            const reds = m.events.filter((e) => e.type === "red_card");

            return (
              <div key={m.id} className="panel p-5">
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {phaseLabel}
                  {m.notes ? ` · ${m.notes}` : ""}
                </p>
                <p className="mt-1 text-lg font-medium text-white">
                  {nameA} <span className="text-[var(--muted)]">vs</span> {nameB}
                </p>

                {m.resultType ? (
                  <div className="mt-2 space-y-1 text-sm text-emerald-300">
                    <p>
                      Hasil: {RESULT_TYPE_LABEL[m.resultType]}{" "}
                      {m.scoreA != null && m.scoreB != null
                        ? `${m.scoreA}-${m.scoreB}`
                        : ""}{" "}
                      · Pemenang: {m.winnerTeam?.name ?? "—"}
                    </p>
                    {goals.length > 0 && (
                      <p className="text-[var(--muted)]">
                        Gol:{" "}
                        {goals
                          .map(
                            (e) =>
                              `${e.player.jerseyNumber != null ? `#${e.player.jerseyNumber} ` : ""}${e.player.fullName}`
                          )
                          .join(", ")}
                      </p>
                    )}
                    {yellows.length > 0 && (
                      <p className="text-amber-200/90">
                        Kuning:{" "}
                        {yellows
                          .map(
                            (e) =>
                              `${e.player.jerseyNumber != null ? `#${e.player.jerseyNumber} ` : ""}${e.player.fullName}`
                          )
                          .join(", ")}
                      </p>
                    )}
                    {reds.length > 0 && (
                      <p className="text-red-300">
                        Merah:{" "}
                        {reds
                          .map(
                            (e) =>
                              `${e.player.jerseyNumber != null ? `#${e.player.jerseyNumber} ` : ""}${e.player.fullName}`
                          )
                          .join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-[var(--muted)]">
                      Admin dapat mengubah hasil, gol, dan kartu di bawah.
                    </p>
                  </div>
                ) : null}

                {bothBye ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Slot BYE — tidak perlu dijadwalkan.
                  </p>
                ) : hasTbd ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Menunggu pemenang babak sebelumnya.
                  </p>
                ) : (
                  <>
                    {showSchedule && (
                      <ActionForm
                        action={updateMatchSchedule}
                        className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
                      >
                        <input type="hidden" name="match_id" value={m.id} />
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                          <span className="text-[var(--muted)]">Jadwal</span>
                          <input
                            type="datetime-local"
                            name="scheduled_at"
                            className="input"
                            defaultValue={toLocal(m.scheduledAt)}
                          />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                          <span className="text-[var(--muted)]">Venue</span>
                          <input
                            name="venue"
                            className="input"
                            defaultValue={m.venue ?? ""}
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

                    {canManageScore && m.slotA.team && m.slotB.team && (
                      <MatchScoreForm
                        matchId={m.id}
                        isRr={isRr}
                        isEdit={Boolean(m.resultType)}
                        teamA={{
                          id: m.slotA.team.id,
                          name: m.slotA.team.name,
                          players: m.slotA.team.players,
                        }}
                        teamB={{
                          id: m.slotB.team.id,
                          name: m.slotB.team.name,
                          players: m.slotB.team.players,
                        }}
                        initial={{
                          resultType: m.resultType ?? "score",
                          winnerTeamId: m.winnerTeamId ?? "",
                          scoreA: m.scoreA,
                          scoreB: m.scoreB,
                          forfeitedTeamId: m.forfeitedTeamId ?? "",
                          notes: m.notes ?? "",
                          events: m.events.map((e) => ({
                            type: e.type,
                            teamId: e.teamId,
                            playerId: e.playerId,
                          })),
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
