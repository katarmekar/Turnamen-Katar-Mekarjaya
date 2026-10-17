import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminHubPage() {
  const profile = await requireRole("admin");
  const [tournamentCount, selected] = await Promise.all([
    prisma.tournament.count(),
    getSelectedTournament(),
  ]);

  const links = [
    {
      href: "/admin/turnamen?baru=1",
      title: "Tambah turnamen",
      desc: "Buat turnamen baru (nama, biaya, rekening, kapasitas)",
    },
    {
      href: "/admin/turnamen",
      title: "Kelola turnamen",
      desc: `${tournamentCount} turnamen — edit status, biaya, format`,
    },
    {
      href: "/admin/pilih",
      title: "Pilih turnamen",
      desc: selected
        ? `Aktif: ${selected.name} — ganti atau masuk panel`
        : "Pilih turnamen lalu kelola pembayaran, bagan, jadwal",
    },
  ];

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-white">
          Panel admin
        </h1>
        <p className="mt-2 text-[var(--muted)]">
          Halo, {profile.fullName ?? "Admin"}. Mulai dari kelola turnamen, lalu
          pilih turnamen yang mau dikerjakan.
        </p>

        <div className="mt-8 grid gap-4">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel block p-6 transition hover:border-[var(--accent)]/50"
            >
              <p className="text-lg font-medium text-white">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.desc}</p>
            </Link>
          ))}
        </div>

        {selected && (
          <p className="mt-6 text-center text-sm text-[var(--muted)]">
            Turnamen terpilih:{" "}
            <Link
              href="/admin/panel"
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {selected.name} → buka panel
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
