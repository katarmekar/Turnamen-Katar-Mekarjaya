import Link from "next/link";
import { AdminPageShell } from "@/components/admin-page-shell";
import { BracketShufflePanel } from "@/components/bracket-shuffle-panel";
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
          groupIndex: true,
          round: true,
        },
      },
      _count: { select: { matches: true } },
    },
  });

  const pendingGroupMatches = tournament.matches.filter(
    (m) => m.groupIndex != null && !m.resultType
  ).length;
  const hasKnockoutPhase = tournament.matches.some(
    (m) => m.groupIndex == null && m.round >= 10
  );

  return (
    <AdminPageShell
      profile={profile}
      title="Acak / buat bagan"
      description={tournament.name}
      actions={
        <Link
          href="/bagan"
          className="btn-ghost inline-flex border border-white/15"
        >
          Lihat bagan publik
        </Link>
      }
    >
        <BracketShufflePanel
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          status={tournament.status}
          competitionFormat={tournament.competitionFormat}
          maxTeams={tournament.maxTeams}
          bracketSize={tournament.bracketSize}
          bracketLocked={tournament.bracketLocked}
          matchCount={tournament._count.matches}
          groupCount={tournament.groupCount}
          maxTeamsPerGroup={tournament.maxTeamsPerGroup}
          qualifyPerGroup={tournament.qualifyPerGroup}
          teams={tournament.teams}
          slots={tournament.bracketSlots}
          matches={tournament.matches}
          pendingGroupMatches={pendingGroupMatches}
          hasKnockoutPhase={hasKnockoutPhase}
        />
    </AdminPageShell>
  );
}
