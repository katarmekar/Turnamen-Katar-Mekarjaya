import { prisma } from "@/lib/prisma";

export type CardFineRates = {
  yellowCardFine: number;
  redCardFine: number;
};

export type TeamCardCounts = {
  yellow: number;
  red: number;
};

export type DepositSummary = {
  deposit: number;
  yellow: number;
  red: number;
  yellowFineTotal: number;
  redFineTotal: number;
  fineTotal: number;
  remaining: number;
};

export type TeamDepositRow = {
  team: {
    id: string;
    name: string;
    city: string | null;
    status: string;
    depositAmount: unknown;
  };
  summary: DepositSummary;
};

export function toMoneyNumber(
  value: number | string | { toString(): string } | null | undefined
): number {
  if (value == null) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

export function summarizeDeposit(
  deposit: number,
  cards: TeamCardCounts,
  rates: CardFineRates
): DepositSummary {
  const yellowFineTotal = cards.yellow * rates.yellowCardFine;
  const redFineTotal = cards.red * rates.redCardFine;
  const fineTotal = yellowFineTotal + redFineTotal;
  return {
    deposit,
    yellow: cards.yellow,
    red: cards.red,
    yellowFineTotal,
    redFineTotal,
    fineTotal,
    remaining: deposit - fineTotal,
  };
}

/** Deposit, kartu, dan sisa untuk satu tim. */
export async function getTeamDepositSummary(
  teamId: string,
  tournamentId: string,
  depositAmount: number | string | { toString(): string } | null | undefined,
  rates: CardFineRates
): Promise<DepositSummary> {
  const events = await prisma.matchEvent.findMany({
    where: {
      teamId,
      type: { in: ["yellow_card", "red_card"] },
      match: { tournamentId },
    },
    select: { type: true },
  });

  const cards: TeamCardCounts = { yellow: 0, red: 0 };
  for (const e of events) {
    if (e.type === "yellow_card") cards.yellow += 1;
    if (e.type === "red_card") cards.red += 1;
  }

  return summarizeDeposit(toMoneyNumber(depositAmount), cards, rates);
}

/** Deposit, kartu, dan sisa per tim dalam satu turnamen. */
export async function getTournamentDepositRows(
  tournamentId: string,
  rates: CardFineRates
): Promise<TeamDepositRow[]> {
  const teams = await prisma.team.findMany({
    where: { tournamentId },
    select: {
      id: true,
      name: true,
      city: true,
      status: true,
      depositAmount: true,
    },
    orderBy: { name: "asc" },
  });

  const teamIds = teams.map((t) => t.id);
  const events =
    teamIds.length === 0
      ? []
      : await prisma.matchEvent.findMany({
          where: {
            teamId: { in: teamIds },
            type: { in: ["yellow_card", "red_card"] },
            match: { tournamentId },
          },
          select: { teamId: true, type: true },
        });

  const cardCounts = new Map<string, TeamCardCounts>();
  for (const id of teamIds) {
    cardCounts.set(id, { yellow: 0, red: 0 });
  }
  for (const e of events) {
    const row = cardCounts.get(e.teamId);
    if (!row) continue;
    if (e.type === "yellow_card") row.yellow += 1;
    if (e.type === "red_card") row.red += 1;
  }

  return teams.map((team) => {
    const cards = cardCounts.get(team.id) ?? { yellow: 0, red: 0 };
    const deposit = toMoneyNumber(team.depositAmount);
    return {
      team,
      summary: summarizeDeposit(deposit, cards, rates),
    };
  });
}
