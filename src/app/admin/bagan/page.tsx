import Link from "next/link";
import { AdminSectionNav } from "@/components/admin-section-nav";
import { BracketShufflePanel } from "@/components/bracket-shuffle-panel";
import { SiteHeader } from "@/components/site-header";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminBaganPage() {
  const profile = await requireRole("admin");
  const selected = await requireSelectedTournament();

  const tournament = await prisma.tournament.findUniqueOrThrow({
    where: { id: selected.id },
    include: {
      teams: {
        where: {
          status: {
            in: ["pending_payment", "awaiting_confirm", "confirmed"],
          },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, status: true },
      },
      bracketSlots: {
        include: { team: { select: { id: true, name: true } } },
        orderBy: [{ round: "asc" }, { side: "asc" }, { position: "asc" }],
      },
      matches: {
        select: {
          slotAId: true,
          slotBId: true,
          winnerTeamId: true,
          resultType: true,
        },
      },
      _count: { select: { matches: true } },
    },
  });

  return (
    <div className="hex-grid min-h-screen">
      <SiteHeader profile={profile} />
      <main className="mx-auto max-w-[90rem] px-4 py-10">
        <AdminSectionNav homeHref="/admin/panel" />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">
              Acak / buat bagan
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{tournament.name}</p>
          </div>
          <Link
            href="/bagan"
            className="btn-ghost inline-flex border border-white/15"
          >
            Lihat bagan publik
          </Link>
        </div>

        <div className="mt-6">
          <BracketShufflePanel
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            status={tournament.status}
            competitionFormat={tournament.competitionFormat}
            maxTeams={tournament.maxTeams}
            bracketSize={tournament.bracketSize}
            bracketLocked={tournament.bracketLocked}
            matchCount={tournament._count.matches}
            teams={tournament.teams}
            slots={tournament.bracketSlots}
            matches={tournament.matches}
          />
        </div>
      </main>
    </div>
  );
}
