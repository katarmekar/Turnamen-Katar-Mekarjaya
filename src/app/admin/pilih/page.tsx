import { AdminSectionNav } from "@/components/admin-section-nav";
import { SiteHeader } from "@/components/site-header";
import { TournamentPickList } from "@/components/tournament-pick-list";
import { getSelectedTournamentId } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { COMPETITION_FORMAT_LABEL, formatIdr } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function AdminPilihTurnamenPage() {
  const profile = await requireRole("admin");
  const [tournaments, selectedId] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { teams: true } } },
    }),
    getSelectedTournamentId(),
  ]);

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} showBagan={!!selectedId} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AdminSectionNav homeHref="/admin" />
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
          Pilih turnamen
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Pilih turnamen yang ingin dikelola. Setelah itu Anda masuk ke panel
          pembayaran, bagan, dan jadwal.
        </p>

        {tournaments.length === 0 ? (
          <div className="panel mt-6 space-y-3 p-6">
            <p className="text-sm text-[var(--muted)]">
              Belum ada turnamen. Buat dulu di kelola turnamen.
            </p>
            <Link
              href="/admin/turnamen?baru=1"
              className="btn-primary inline-flex"
            >
              Tambah turnamen
            </Link>
          </div>
        ) : (
          <TournamentPickList
            selectedId={selectedId}
            tournaments={tournaments.map((t) => ({
              id: t.id,
              name: t.name,
              status: t.status,
              formatLabel:
                COMPETITION_FORMAT_LABEL[t.competitionFormat] ??
                t.competitionFormat,
              feeLabel: formatIdr(t.registrationFee),
              teamCount: t._count.teams,
              maxTeams: t.maxTeams,
            }))}
          />
        )}
      </main>
    </div>
  );
}
