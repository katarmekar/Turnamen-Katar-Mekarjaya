import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { TournamentBracketView } from "@/components/tournament-bracket-view";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABEL, TEAM_STATUS_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  paymentReuploadRequired,
  reuploadPaymentHref,
} from "@/lib/payment-gate";
import { getTournamentForBracket } from "@/lib/tournament-bracket";
import { hasAcceptedCurrentRules } from "@/lib/tournament-rules";

function formatSchedule(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function DashboardPage() {
  const profile = await requireProfile();

  if (profile.role === "admin") {
    redirect("/admin");
  }

  const teams = await prisma.team.findMany({
    where: { captainId: profile.id },
    include: {
      tournament: true,
      players: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          fullName: true,
          jerseyNumber: true,
          position: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const team = teams[0] ?? null;
  const confirmedTeams = teams.filter((t) => t.status === "confirmed");
  const rejectedTeams = teams.filter((t) => paymentReuploadRequired(t.status));
  const paymentBlocked = team ? paymentReuploadRequired(team.status) : false;
  const rulesAccepted = team
    ? hasAcceptedCurrentRules({
        rulesVersion: team.tournament.rulesVersion,
        rulesAcceptedVersion: team.rulesAcceptedVersion,
      })
    : false;

  const [openCount, matches, bracketTournament] = await Promise.all([
    prisma.tournament.count({
      where: {
        status: "open",
        NOT: {
          id: { in: teams.map((t) => t.tournamentId) },
        },
      },
    }),
    team && rulesAccepted
      ? prisma.match.findMany({
          where: {
            OR: [
              { slotA: { teamId: team.id } },
              { slotB: { teamId: team.id } },
            ],
          },
          include: {
            slotA: { include: { team: true } },
            slotB: { include: { team: true } },
            winnerTeam: true,
          },
          orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
          take: 8,
        })
      : Promise.resolve([]),
    getTournamentForBracket(team?.tournamentId),
  ]);

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} compactNav />
      <main className="mx-auto max-w-[90rem] px-4 py-10">
        <h1 className="page-title text-5xl text-white">
          Dashboard manajer
        </h1>
        <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
          Halo, {profile.fullName ?? "Manajer"}. Kelola tim dan pantau bagan
          turnamen di satu tempat.
        </p>

        {rejectedTeams.length > 0 && (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-4">
            <p className="font-medium text-white">Bukti pembayaran ditolak</p>
            <p className="mt-1 text-sm text-red-100">
              Upload ulang bukti dulu. Menu peraturan, jadwal, pemain, dan
              bagan untuk tim ini terkunci sampai bukti baru terkirim.
            </p>
            <ul className="mt-3 space-y-2">
              {rejectedTeams.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-white">
                    {t.name}
                    {t.rejectionNote ? ` — ${t.rejectionNote}` : ""}
                  </span>
                  <Link
                    href={reuploadPaymentHref(t.id)}
                    className="btn-primary inline-flex text-sm"
                  >
                    Upload ulang bukti
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold text-white">Status akun</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Peran</dt>
                <dd className="text-white">
                  {ROLE_LABEL[profile.role] ?? profile.role}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Telepon</dt>
                <dd className="text-white">{profile.phone ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h3 className="text-sm font-semibold text-white">
                Jadwal pertandingan
              </h3>
              {!team ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Daftarkan tim terlebih dahulu.
                </p>
              ) : paymentBlocked ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Jadwal terkunci sampai bukti pembayaran diupload ulang.
                </p>
              ) : !rulesAccepted ? (
                <div className="mt-2 space-y-3">
                  <p className="text-sm text-[var(--muted)]">
                    Jadwal tersembunyi sampai Anda menyetujui peraturan
                    turnamen.
                  </p>
                  <Link
                    href={`/dashboard/peraturan?teamId=${team.id}`}
                    className="btn-primary inline-flex text-sm"
                  >
                    Baca & setujui peraturan
                  </Link>
                </div>
              ) : matches.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Belum ada jadwal. Muncul setelah admin membuat bagan & mengisi
                  jadwal.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {matches.map((m) => {
                    const nameA = m.slotA.isBye
                      ? "BYE"
                      : (m.slotA.team?.name ?? "TBD");
                    const nameB = m.slotB.isBye
                      ? "BYE"
                      : (m.slotB.team?.name ?? "TBD");
                    const isHome = m.slotA.teamId === team.id;
                    const opponent = isHome ? nameB : nameA;

                    return (
                      <li
                        key={m.id}
                        className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-sm"
                      >
                        <p className="text-white">
                          vs <span className="font-medium">{opponent}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            · R{m.round}
                          </span>
                        </p>
                        <p className="mt-1 text-[var(--muted)]">
                          {m.scheduledAt
                            ? formatSchedule(m.scheduledAt)
                            : "Jadwal belum ditetapkan"}
                          {m.venue ? ` · ${m.venue}` : ""}
                        </p>
                        {m.resultType && (
                          <p className="mt-1 text-emerald-300">
                            Selesai
                            {m.winnerTeamId == null
                              ? " — Seri"
                              : m.winnerTeamId === team.id
                                ? " — Menang"
                                : " — Kalah"}
                            {m.scoreA != null && m.scoreB != null
                              ? ` (${m.scoreA}-${m.scoreB})`
                              : ` (${m.resultType})`}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="panel p-6">
            <h2 className="text-lg font-semibold text-white">Tim & pembayaran</h2>
            {teams.length > 0 ? (
              <>
                <ul className="mt-4 space-y-3">
                  {teams.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2.5 text-sm"
                    >
                      <p className="font-medium text-white">{t.name}</p>
                      <p className="mt-1 text-[var(--muted)]">
                        {t.tournament.name} · {t.city ?? "—"} ·{" "}
                        {TEAM_STATUS_LABEL[t.status] ?? t.status}
                      </p>
                      <Link
                        href={`/dashboard/tim?teamId=${t.id}`}
                        className="mt-3 inline-flex rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:border-[var(--accent)]/40 hover:bg-white/10"
                      >
                        Kelola pembayaran
                      </Link>
                    </li>
                  ))}
                </ul>
                {openCount > 0 && (
                  <Link
                    href="/dashboard/daftar-tim"
                    className="btn-ghost mt-6 inline-flex border border-white/15"
                  >
                    Daftar ke turnamen lain
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Belum mendaftarkan tim. Pilih turnamen, daftarkan nama tim, lalu
                  transfer biaya pendaftaran.
                </p>
                <Link
                  href="/dashboard/daftar-tim"
                  className="btn-primary mt-6 inline-flex"
                >
                  Daftar tim
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="panel mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Peraturan</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Wajib dibaca dan disetujui manajer sebelum jadwal pertandingan
                tampil.
              </p>
            </div>
            {team && !paymentBlocked && (
              <Link
                href={`/dashboard/peraturan?teamId=${team.id}`}
                className="btn-primary shrink-0"
              >
                {rulesAccepted ? "Lihat peraturan" : "Baca & setujui"}
              </Link>
            )}
          </div>
          {!team ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Daftarkan tim terlebih dahulu.
            </p>
          ) : paymentBlocked ? (
            <p className="mt-4 text-sm text-amber-200">
              Terkunci. Upload ulang bukti pembayaran terlebih dahulu.
            </p>
          ) : (
            <p
              className={
                rulesAccepted
                  ? "mt-4 text-sm text-emerald-300"
                  : "mt-4 text-sm text-amber-200"
              }
            >
              {rulesAccepted
                ? `Sudah disetujui (versi ${team.tournament.rulesVersion}).`
                : `Belum disetujui — versi peraturan saat ini: ${team.tournament.rulesVersion}.`}
            </p>
          )}
        </div>

        <div className="panel mt-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Pemain</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {confirmedTeams.length > 0 &&
                confirmedTeams.every((t) => t.tournament.bracketLocked)
                  ? "Setelah bagan ditetapkan, data pemain hanya bisa dilihat."
                  : confirmedTeams.some((t) => t.tournament.bracketLocked)
                    ? "Tim yang bagannya sudah ditetapkan hanya bisa dilihat. Tim lain masih bisa dikelola."
                    : "Lihat daftar nama di sini. Tambah, edit, atau hapus lewat kelola pemain."}
              </p>
            </div>
            {confirmedTeams[0] && (
              <Link
                href={`/dashboard/pemain?teamId=${confirmedTeams[0].id}`}
                className="btn-primary shrink-0"
              >
                {confirmedTeams[0].tournament.bracketLocked
                  ? "Lihat pemain"
                  : "Kelola pemain"}
              </Link>
            )}
          </div>

          {teams.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Daftarkan tim terlebih dahulu.
            </p>
          ) : confirmedTeams.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              {rejectedTeams.length > 0
                ? "Pemain terkunci. Upload ulang bukti yang ditolak dulu, lalu tunggu konfirmasi admin."
                : "Daftar pemain tersedia setelah pembayaran dikonfirmasi admin."}
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {confirmedTeams.map((t) => (
                <div key={t.id}>
                  {confirmedTeams.length > 1 && (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white">{t.name}</p>
                      <Link
                        href={`/dashboard/pemain?teamId=${t.id}`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        {t.tournament.bracketLocked ? "Lihat" : "Kelola"}
                      </Link>
                    </div>
                  )}
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    {t.players.length} / {t.tournament.maxPlayersPerTeam} pemain
                  </p>
                  {t.players.length === 0 ? (
                    <p className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-4 text-sm text-[var(--muted)]">
                      {t.tournament.bracketLocked
                        ? "Belum ada pemain. Bagan sudah ditetapkan, data tidak bisa ditambah."
                        : "Belum ada pemain. Masuk ke kelola pemain untuk menambah."}
                    </p>
                  ) : (
                    <ul className="flex max-h-[calc(2.5rem*5+0.375rem*4+1rem)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] bg-black/20 p-2 pr-1">
                      {t.players.map((p, index) => (
                        <li
                          key={p.id}
                          className="flex h-10 shrink-0 items-center gap-3 rounded-md px-2.5 text-sm"
                        >
                          <span className="w-6 shrink-0 text-[var(--muted)]">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 flex-1 truncate text-white">
                            {p.fullName}
                          </span>
                          {p.jerseyNumber != null && (
                            <span className="shrink-0 text-[var(--muted)]">
                              #{p.jerseyNumber}
                            </span>
                          )}
                          {p.position && (
                            <span className="hidden shrink-0 text-[var(--muted)] sm:inline">
                              {p.position}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <section id="bagan" className="mt-10 scroll-mt-8">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
              {bracketTournament?.competitionFormat === "single_round_robin" ||
              bracketTournament?.competitionFormat === "double_round_robin"
                ? "Sistem liga (fase grup)"
                : "Sistem gugur"}
            </p>
            <h2 className="page-title mt-1 text-3xl text-white sm:text-4xl">
              Bagan pertandingan
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {bracketTournament
                ? `Turnamen: ${bracketTournament.name}`
                : "Belum ada turnamen aktif untuk ditampilkan."}
            </p>
          </div>
          {paymentBlocked ? (
            <div className="panel p-6">
              <p className="text-sm text-[var(--muted)]">
                Bagan terkunci sampai bukti pembayaran diupload ulang.
              </p>
            </div>
          ) : (
            <TournamentBracketView
              tournament={bracketTournament}
              showHeading={false}
            />
          )}
        </section>
      </main>
    </div>
  );
}
