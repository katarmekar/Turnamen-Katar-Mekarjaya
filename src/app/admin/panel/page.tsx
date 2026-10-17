import Link from "next/link";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { clearSelectedTournament } from "@/app/actions/admin";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { COMPETITION_FORMAT_LABEL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminPanelPage() {
  const profile = await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const [awaitingPayment, confirmed, teamCount] = await Promise.all([
    prisma.team.count({
      where: { tournamentId: tournament.id, status: "awaiting_confirm" },
    }),
    prisma.team.count({
      where: { tournamentId: tournament.id, status: "confirmed" },
    }),
    prisma.team.count({ where: { tournamentId: tournament.id } }),
  ]);

  const links = [
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
      href: "/admin/dokumen",
      title: "Kelola kartu dokumen",
      desc: "Kartu identitas pemain (custom)",
    },
    {
      href: "/admin/form-pemain",
      title: "Form data pemain",
      desc: "Field form tambah pemain (custom)",
    },
  ];

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <AdminSectionNav homeHref="/admin" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--accent)]">
              Turnamen aktif
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white sm:text-5xl">
              {tournament.name}
            </h1>
            <p className="mt-2 text-[var(--muted)]">
              Status {tournament.status} ·{" "}
              {COMPETITION_FORMAT_LABEL[tournament.competitionFormat] ??
                tournament.competitionFormat}{" "}
              · max {tournament.maxTeams} tim
              {tournament.bracketLocked ? " · bagan terkunci" : ""}
            </p>
          </div>
          <form action={clearSelectedTournament}>
            <button type="submit" className="btn-ghost border border-white/15">
              Ganti turnamen
            </button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-sm text-[var(--muted)]">Total tim</p>
            <p className="mt-1 text-3xl font-semibold text-white">{teamCount}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm text-[var(--muted)]">Confirmed</p>
            <p className="mt-1 text-3xl font-semibold text-white">{confirmed}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm text-[var(--muted)]">Menunggu bayar</p>
            <p className="mt-1 text-3xl font-semibold text-white">
              {awaitingPayment}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </main>
    </div>
  );
}
