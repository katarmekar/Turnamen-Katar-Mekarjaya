import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireProfile } from "@/lib/auth";
import { TEAM_STATUS_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

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
    include: { tournament: true },
    orderBy: { createdAt: "desc" },
  });
  const team = teams[0] ?? null;

  const openCount = await prisma.tournament.count({
    where: {
      status: "open",
      NOT: {
        id: { in: teams.map((t) => t.tournamentId) },
      },
    },
  });

  const matches = team
    ? await prisma.match.findMany({
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
    : [];

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-white">
          Dashboard kapten
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Halo, {profile.fullName ?? "Kapten"}.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="panel p-6">
            <h2 className="text-lg font-semibold text-white">Status akun</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Peran</dt>
                <dd className="capitalize text-white">{profile.role}</dd>
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
            <h2 className="text-lg font-semibold text-white">Tim Anda</h2>
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/tim?teamId=${t.id}`}
                          className="text-xs text-[var(--accent)] hover:underline"
                        >
                          Pembayaran
                        </Link>
                        {t.status === "confirmed" && (
                          <Link
                            href={`/dashboard/pemain?teamId=${t.id}`}
                            className="text-xs text-[var(--accent)] hover:underline"
                          >
                            Pemain & berkas
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  {openCount > 0 && (
                    <Link
                      href="/dashboard/daftar-tim"
                      className="btn-ghost border border-white/15"
                    >
                      Daftar ke turnamen lain
                    </Link>
                  )}
                </div>
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
      </main>
    </div>
  );
}
