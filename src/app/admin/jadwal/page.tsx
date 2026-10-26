import { AdminPageShell } from "@/components/admin-page-shell";
import { ActionForm } from "@/components/action-form-status";
import { submitScore, updateMatchSchedule } from "@/app/actions/admin";
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
      slotA: { include: { team: true } },
      slotB: { include: { team: true } },
      winnerTeam: true,
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
              const schedulePassed =
                !m.scheduledAt || m.scheduledAt.getTime() <= Date.now();
              const canScore =
                bothReady &&
                !m.resultType &&
                schedulePassed &&
                !m.slotA.isBye &&
                !m.slotB.isBye;
              const showSchedule = !m.resultType && bothReady;

              const toLocal = (d: Date | null) => {
                if (!d) return "";
                const pad = (n: number) => String(n).padStart(2, "0");
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
              };

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
                    <p className="mt-2 text-sm text-emerald-300">
                      Hasil: {RESULT_TYPE_LABEL[m.resultType]}{" "}
                      {m.scoreA != null && m.scoreB != null
                        ? `${m.scoreA}-${m.scoreB}`
                        : ""}{" "}
                      · Pemenang: {m.winnerTeam?.name ?? "—"}
                    </p>
                  ) : bothBye ? (
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
                        <button type="submit" className="btn-ghost border border-white/15 w-full sm:w-auto">
                          Simpan jadwal
                        </button>
                      </ActionForm>
                      )}

                      {canScore && (
                        <ActionForm
                          action={submitScore}
                          className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
                        >
                          <input type="hidden" name="match_id" value={m.id} />
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="text-[var(--muted)]">Tipe hasil</span>
                            <select name="result_type" className="input" defaultValue="score">
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
                              defaultValue={isRr ? "" : m.slotA.teamId!}
                            >
                              {isRr && <option value="">Seri / belum pilih</option>}
                              <option value={m.slotA.teamId!}>{nameA}</option>
                              <option value={m.slotB.teamId!}>{nameB}</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="text-[var(--muted)]">Skor A</span>
                            <input name="score_a" type="number" min={0} className="input" />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="text-[var(--muted)]">Skor B</span>
                            <input name="score_b" type="number" min={0} className="input" />
                          </label>
                          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                            <span className="text-[var(--muted)]">
                              Tim WO/DQ (opsional)
                            </span>
                            <select name="forfeited_team_id" className="input" defaultValue="">
                              <option value="">—</option>
                              <option value={m.slotA.teamId!}>{nameA}</option>
                              <option value={m.slotB.teamId!}>{nameB}</option>
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                            <span className="text-[var(--muted)]">Catatan</span>
                            <input name="notes" className="input" />
                          </label>
                          <button type="submit" className="btn-primary sm:col-span-2">
                            Simpan hasil
                          </button>
                        </ActionForm>
                      )}

                      {bothReady && m.scheduledAt && !schedulePassed && (
                        <p className="mt-3 text-sm text-amber-300">
                          Input skor tersedia setelah jadwal lewat.
                        </p>
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
