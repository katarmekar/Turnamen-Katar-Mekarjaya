import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  let profile = null;
  let openTournament = null;

  try {
    profile = await getCurrentProfile();
    if (profile?.role === "admin") redirect("/admin");
    if (profile?.role === "captain") redirect("/dashboard");

    openTournament = await prisma.tournament.findFirst({
      where: { status: { in: ["open", "ongoing"] } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // DB belum terkoneksi — UI tetap tampil
  }

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl flex-col justify-center px-4 py-16">
        <p className="mb-3 text-sm uppercase tracking-[0.25em] text-[var(--accent)]">
          Pendaftaran online
        </p>
        <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-6xl leading-none tracking-wide text-white md:text-8xl">
          {openTournament?.name ?? "MekarJaya Turnamen"}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--muted)]">
          {openTournament?.description ??
            "Daftarkan tim, unggah bukti pembayaran, lengkapi data pemain, dan ikuti bagan pertandingan secara langsung."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary">
            Daftar akun manajer
          </Link>
          <Link href="/login" className="btn-ghost border border-white/15">
            Masuk
          </Link>
        </div>
      </main>
    </div>
  );
}
