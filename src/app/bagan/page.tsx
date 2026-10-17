import {
  BracketFilled,
  BracketSkeleton,
} from "@/components/bracket-skeleton";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { StandingsTable } from "@/components/standings-table";
import { getCurrentProfile } from "@/lib/auth";
import { COMPETITION_FORMAT_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";

export default async function BaganPage() {
  let profile = null;
  let tournament = null;

  try {
    profile = await getCurrentProfile();
    tournament = await prisma.tournament.findFirst({
      where: { status: { in: ["open", "ongoing", "done"] } },
      orderBy: { createdAt: "desc" },
      include: {
        teams: {
          where: {
            status: {
              in: ["pending_payment", "awaiting_confirm", "confirmed"],
            },
          },
          orderBy: { createdAt: "asc" },
        },
        bracketSlots: {
          include: { team: true },
          orderBy: [{ round: "asc" }, { side: "asc" }, { position: "asc" }],
        },
        matches: {
          include: {
            slotA: { include: { team: true } },
            slotB: { include: { team: true } },
            winnerTeam: true,
          },
          orderBy: [{ round: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  } catch {
    // DB offline
  }

  const isRr =
    tournament?.competitionFormat === "single_round_robin" ||
    tournament?.competitionFormat === "double_round_robin";
  const hasSchedule =
    tournament != null && tournament.matches.length > 0;
  const confirmedCount =
    tournament?.teams.filter((t) => t.status === "confirmed").length ?? 0;
  const standings = tournament
    ? computeStandings(tournament.matches)
    : [];

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-[90rem] px-4 py-10">
        <AdminSectionNav homeHref="/" />
        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
          {isRr ? "Sistem liga" : "Sistem gugur"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl tracking-wide text-white">
          {tournament?.name ?? "Bagan"}
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          {tournament
            ? `Status ${tournament.status} · ${
                COMPETITION_FORMAT_LABEL[tournament.competitionFormat] ??
                tournament.competitionFormat
              } · kapasitas ${tournament.maxTeams}${
                hasSchedule
                  ? isRr
                    ? ` · ${tournament.matches.length} pertandingan`
                    : ` · bagan ${tournament.bracketSize ?? "—"}`
                  : " · belum diacak"
              } · ${tournament.teams.length} tim antri · ${confirmedCount} siap acak`
            : "Belum ada turnamen aktif."}
        </p>

        {!tournament ? (
          <div className="panel mt-8 p-8">
            <p className="text-sm text-[var(--muted)]">Belum ada bagan aktif.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {isRr ? (
              <>
                {hasSchedule ? (
                  <>
                    <div className="panel p-6">
                      <h2 className="font-semibold text-white">Klasemen</h2>
                      <div className="mt-4">
                        <StandingsTable rows={standings} />
                      </div>
                    </div>
                    <div className="panel p-6">
                      <h2 className="font-semibold text-white">
                        Daftar pertandingan
                      </h2>
                      <ul className="mt-4 space-y-2 text-sm">
                        {tournament.matches.map((m) => (
                          <li
                            key={m.id}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--muted)]"
                          >
                            <span className="text-white">
                              {m.slotA.team?.name ?? "—"} vs{" "}
                              {m.slotB.team?.name ?? "—"}
                            </span>
                            {m.round === 2 ? " · Leg 2" : ""}
                            {m.resultType
                              ? m.scoreA != null && m.scoreB != null
                                ? ` · ${m.scoreA}-${m.scoreB}`
                                : ` · ${m.resultType}`
                              : " · Belum main"}
                            {m.winnerTeam
                              ? ` · ${m.winnerTeam.name}`
                              : m.resultType === "score" &&
                                  m.scoreA === m.scoreB
                                ? " · Seri"
                                : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="panel p-6">
                    <p className="text-sm text-[var(--muted)]">
                      Format{" "}
                      {COMPETITION_FORMAT_LABEL[tournament.competitionFormat]}.
                      Jadwal pertandingan dibuat setelah admin menekan{" "}
                      <strong className="text-white">Acak tim</strong>.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {!hasSchedule && tournament.teams.length > 0 && (
                  <div className="panel space-y-2 p-4">
                    <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                      Tim di antrian bagan ({confirmedCount} siap acak)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tournament.teams.map((t) => (
                        <span
                          key={t.id}
                          className={`bracket-team-chip ${
                            t.status === "confirmed" ? "is-ready" : "is-wait"
                          }`}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      Nama masuk ke slot bagan setelah admin menekan Acak.
                    </p>
                  </div>
                )}
                <div className="mt-2">
                  {hasSchedule && tournament.bracketSlots.length > 0 ? (
                    <BracketFilled
                      slots={tournament.bracketSlots}
                      bracketSize={
                        tournament.bracketSize ?? tournament.maxTeams
                      }
                      matches={tournament.matches.map((m) => ({
                        slotAId: m.slotAId,
                        slotBId: m.slotBId,
                        winnerTeamId: m.winnerTeamId,
                        resultType: m.resultType,
                      }))}
                    />
                  ) : (
                    <BracketSkeleton maxTeams={tournament.maxTeams} />
                  )}
                </div>
              </div>
            )}

            {!isRr &&
              hasSchedule &&
              tournament.matches.some((m) => m.resultType) && (
                <div className="panel p-6">
                  <h2 className="font-semibold text-white">
                    Hasil pertandingan
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm">
                    {tournament.matches
                      .filter((m) => m.resultType)
                      .map((m) => (
                        <li key={m.id} className="text-[var(--muted)]">
                          R{m.round}: {m.slotA.team?.name ?? "BYE"} vs{" "}
                          {m.slotB.team?.name ?? "BYE"} →{" "}
                          <span className="text-white">
                            {m.winnerTeam?.name ??
                              (m.scoreA === m.scoreB ? "Seri" : "—")}
                          </span>
                          {m.scoreA != null && m.scoreB != null
                            ? ` (${m.scoreA}-${m.scoreB})`
                            : ` (${m.resultType})`}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </main>
    </div>
  );
}
