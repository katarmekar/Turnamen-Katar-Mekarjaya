import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const bracketInclude = {
  teams: {
    where: {
      status: {
        in: ["pending_payment", "awaiting_confirm", "confirmed"],
      },
    },
    orderBy: { createdAt: "asc" },
  },
  bracketSlots: {
    include: { team: true },
    orderBy: [{ round: "asc" }, { side: "asc" }, { position: "asc" }],
  },
  matches: {
    include: {
      slotA: { include: { team: true } },
      slotB: { include: { team: true } },
      winnerTeam: true,
    },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
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
