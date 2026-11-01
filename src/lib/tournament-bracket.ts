import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Hanya field aman untuk Client Component (tanpa Decimal Prisma). */
const teamBriefSelect = {
  id: true,
  name: true,
  status: true,
} satisfies Prisma.TeamSelect;

const bracketInclude = {
  teams: {
    where: {
      status: {
        in: ["pending_payment", "awaiting_confirm", "confirmed"],
      },
    },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
  },
  bracketSlots: {
    include: { team: { select: teamBriefSelect } },
    orderBy: [
      { round: "asc" as const },
      { side: "asc" as const },
      { position: "asc" as const },
    ],
  },
  matches: {
    include: {
      slotA: { include: { team: { select: teamBriefSelect } } },
      slotB: { include: { team: { select: teamBriefSelect } } },
      winnerTeam: { select: { id: true, name: true } },
      events: {
        where: { type: "goal" as const },
        include: {
          player: { select: { id: true, fullName: true } },
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { round: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
} satisfies Prisma.TournamentInclude;

export type TournamentForBracket = Prisma.TournamentGetPayload<{
  include: typeof bracketInclude;
}>;

/** Ambil turnamen untuk tampilan bagan (opsional filter id). */
export async function getTournamentForBracket(
  tournamentId?: string | null
): Promise<TournamentForBracket | null> {
  if (tournamentId) {
    return prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: bracketInclude,
    });
  }

  return prisma.tournament.findFirst({
    where: { status: { in: ["open", "ongoing", "done"] } },
    orderBy: { createdAt: "desc" },
    include: bracketInclude,
  });
}
