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
