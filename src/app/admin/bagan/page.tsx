import Link from "next/link";
import { AdminPageShell } from "@/components/admin-page-shell";
import { BracketShufflePanel } from "@/components/bracket-shuffle-panel";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  KNOCKOUT_ROUND_BASE,
  resolveQualifiers,
} from "@/lib/bracket";
import { isLeagueFormat } from "@/lib/league";
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
          notes: true,
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
    (m) => m.groupIndex == null && m.round >= KNOCKOUT_ROUND_BASE
  );
  const canEditKnockout =
    hasKnockoutPhase &&
    !tournament.matches.some(
      (m) =>
        m.groupIndex == null &&
        m.round >= KNOCKOUT_ROUND_BASE &&
        m.resultType != null &&
        !(m.notes ?? "").includes("BYE")
    );

  const r1Slots = tournament.bracketSlots
    .filter(
      (s) =>
        s.groupIndex == null &&
        s.round === KNOCKOUT_ROUND_BASE
    )
    .sort((a, b) => {
      if (a.side !== b.side) return a.side === "left" ? -1 : 1;
      return a.position - b.position;
    });
  const currentKnockoutSlotTeamIds = r1Slots.map((s) =>
    s.isBye ? null : (s.teamId ?? null)
  );

  let knockoutQualifiers: {
    teamId: string;
    name: string;
    groupIndex: number;
    rank: number;
    label: string;
  }[] = [];
  let knockoutMeta: {
    bracketSize: number;
    groupCount: number;
    qualifyPerGroup: number;
  } | null = null;

  if (
    isLeagueFormat(tournament.competitionFormat) &&
    hasKnockoutPhase &&
    pendingGroupMatches === 0
  ) {
    try {
      const resolved = await resolveQualifiers(tournament.id);
      knockoutQualifiers = resolved.qualifiers;
      knockoutMeta = {
        bracketSize: resolved.bracketSize,
        groupCount: resolved.groupCount,
        qualifyPerGroup: resolved.qualifyPerGroup,
      };
    } catch {
      // Panel KO tetap tampil tanpa editor jika resolve gagal
    }
  }

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
          canEditKnockout={canEditKnockout}
          knockoutQualifiers={knockoutQualifiers}
          knockoutMeta={knockoutMeta}
          currentKnockoutSlotTeamIds={currentKnockoutSlotTeamIds}
        />
    </AdminPageShell>
  );
}
