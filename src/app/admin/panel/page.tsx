import Link from "next/link";
import { AdminPageShell } from "@/components/admin-page-shell";
import { clearSelectedTournament } from "@/app/actions/admin";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  COMPETITION_FORMAT_LABEL,
  whatsappChatHref,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

function formatMatchSchedule(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function managerPhone(
  team: {
    contactPhone: string | null;
    captain: { phone: string | null; fullName: string | null } | null;
  } | null
) {
  if (!team) return null;
  const phone = team.contactPhone?.trim() || team.captain?.phone?.trim() || null;
  return phone || null;
}

function managerName(
  team: {
    name: string;
    coachName: string | null;
    captain: { fullName: string | null } | null;
  } | null
) {
  if (!team) return "Manajer";
  return (
    team.coachName?.trim() ||
    team.captain?.fullName?.trim() ||
    `manajer ${team.name}`
  );
}

export default async function AdminPanelPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const now = new Date();

  const [awaitingPayment, confirmed, teamCount, upcomingMatches] =
    await Promise.all([
      prisma.team.count({
        where: { tournamentId: tournament.id, status: "awaiting_confirm" },
      }),
      prisma.team.count({
        where: { tournamentId: tournament.id, status: "confirmed" },
      }),
      prisma.team.count({ where: { tournamentId: tournament.id } }),
      prisma.match.findMany({
        where: {
          tournamentId: tournament.id,
          resultType: null,
          scheduledAt: { gt: now },
        },
        include: {
          slotA: {
            include: {
              team: { include: { captain: true } },
            },
          },
          slotB: {
            include: {
              team: { include: { captain: true } },
            },
          },
        },
        orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
        take: 12,
      }),
    ]);

  const links = [
    {
      href: "/admin/manajer",
      title: "Rekap manajer",
      desc: `${teamCount} tim · kontak & reset password`,
    },
    {
      href: "/admin/pembayaran",
      title: "Konfirmasi pembayaran",
      desc: `${awaitingPayment} menunggu`,
    },
    {
      href: "/admin/bagan",
      title: "Acak / buat bagan",
      desc: `${confirmed} tim confirmed`,
    },
    {
      href: "/admin/jadwal",
      title: "Jadwal & skor",
      desc: "Jadwal, skor, WO, DQ",
    },
    {
      href: "/bagan",
      title: "Lihat bagan publik",
      desc: "Tampilan sistem gugur / liga",
    },
    {
      href: `/admin/turnamen?id=${tournament.id}`,
      title: "Edit turnamen ini",
      desc: "Ubah nama, biaya, status, format",
    },
    {
      href: "/admin/pemain",
      title: "Pemain & berkas",
      desc: "Lihat nama pemain tiap tim dan berkas upload",
    },
    {
      href: "/admin/dokumen",
      title: "Kelola kartu dokumen",
      desc: "Kartu identitas pemain (custom)",
    },
    {
      href: "/admin/form-pemain",
      title: "Form data pemain",
      desc: "Field form tambah pemain (custom)",
    },
    {
      href: "/admin/peraturan",
      title: "Peraturan turnamen",
      desc: `Versi ${tournament.rulesVersion} · tambah / edit / hapus pasal`,
    },
  ];

  return (
    <AdminPageShell
      profile={profile}
      homeHref="/admin"
      homeLabel="Dashboard"
      eyebrow="Turnamen aktif"
      title={tournament.name}
      description={
        <>
          Status {tournament.status} ·{" "}
          {COMPETITION_FORMAT_LABEL[tournament.competitionFormat] ??
            tournament.competitionFormat}{" "}
          · max {tournament.maxTeams} tim
          {tournament.bracketLocked ? " · bagan terkunci" : ""}
        </>
      }
      actions={
        <form action={clearSelectedTournament}>
          <button type="submit" className="btn-ghost border border-white/15">
            Ganti turnamen
          </button>
        </form>
      }
    >
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total tim", value: teamCount },
            { label: "Confirmed", value: confirmed },
            { label: "Menunggu bayar", value: awaitingPayment },
          ].map((stat) => (
            <div
              key={stat.label}
              className="select-none rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-3"
              aria-label={`${stat.label}: ${stat.value}`}
            >
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                {stat.label}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl tracking-wide text-white/90 tabular-nums">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Notifikasi
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Pertandingan akan berlangsung
              </h2>
            </div>
            {upcomingMatches.length > 0 && (
              <Link
                href="/admin/jadwal"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Kelola jadwal →
              </Link>
            )}
          </div>

          {upcomingMatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-[var(--muted)]">
              Tidak ada pertandingan terjadwal yang belum dimulai.
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingMatches.map((m) => {
                const teamA = m.slotA.team;
                const teamB = m.slotB.team;
                const nameA = m.slotA.isBye
                  ? "BYE"
                  : (teamA?.name ?? "TBD");
                const nameB = m.slotB.isBye
                  ? "BYE"
                  : (teamB?.name ?? "TBD");
                const when = m.scheduledAt
                  ? formatMatchSchedule(m.scheduledAt)
                  : "—";
                const venue = m.venue?.trim() || "venue belum diisi";

                const notifySides = [
                  !m.slotA.isBye && teamA
                    ? {
                        key: "a",
                        team: teamA,
                        opponent: nameB,
                        phone: managerPhone(teamA),
                        manager: managerName(teamA),
                      }
                    : null,
                  !m.slotB.isBye && teamB
                    ? {
                        key: "b",
                        team: teamB,
                        opponent: nameA,
                        phone: managerPhone(teamB),
                        manager: managerName(teamB),
                      }
                    : null,
                ].filter((s): s is NonNullable<typeof s> => s != null);

                return (
                  <li key={m.id} className="panel p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                          Round {m.round}
                        </p>
                        <p className="mt-1 text-base font-medium text-white sm:text-lg">
                          {nameA}{" "}
                          <span className="text-[var(--muted)]">vs</span> {nameB}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {when}
                          {m.venue ? ` · ${m.venue}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {notifySides.length === 0 ? (
                        <p className="text-xs text-[var(--muted)]">
                          Tim belum lengkap — belum bisa kirim notifikasi.
                        </p>
                      ) : (
                        notifySides.map((side) => {
                          if (!side.team) return null;
                          const message = [
                            `Halo ${side.manager},`,
                            `pengingat pertandingan ${tournament.name}:`,
                            `${side.team.name} vs ${side.opponent}.`,
                            `Jadwal: ${when}.`,
                            `Lokasi: ${venue}.`,
                            "Mohon hadir tepat waktu. Terima kasih.",
                          ].join(" ");
                          const href = whatsappChatHref(side.phone, message);

                          if (!href) {
                            return (
                              <span
                                key={side.key}
                                className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-[var(--muted)]"
                                title="Nomor WhatsApp manajer belum diisi saat daftar"
                              >
                                WA {side.team.name}: nomor kosong
                              </span>
                            );
                          }

                          return (
                            <a
                              key={side.key}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-primary px-3 py-1.5 text-xs"
                            >
                              WhatsApp manajer {side.team.name}
                            </a>
                          );
                        })
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="mt-12">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Menu kelola
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="panel block p-5 transition hover:border-sky-400/50"
              >
                <p className="font-medium text-white">{item.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
    </AdminPageShell>
  );
}
