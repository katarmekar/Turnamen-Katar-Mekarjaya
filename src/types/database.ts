/**
 * Helper domain (UI) — sumber kebenaran tabel: prisma/schema.prisma
 * Prefer import enum/type dari `@prisma/client` di server code.
 */

export type {
  UserRole,
  TournamentStatus,
  TeamStatus,
  MatchResultType,
  Profile,
  Tournament,
  Team,
  Payment,
  Player,
  PlayerDocument,
  BracketSlot,
  Match,
  TournamentDocCard,
} from "@prisma/client";

/** @deprecated gunakan TournamentDocCard dari admin */
export const PLAYER_DOC_TYPES = [
  "ktp",
  "kk",
  "kia",
  "rapor",
  "akta",
] as const;

/** @deprecated gunakan label dari TournamentDocCard */
export const PLAYER_DOC_LABELS: Record<
  (typeof PLAYER_DOC_TYPES)[number],
  string
> = {
  ktp: "KTP",
  kk: "Kartu Keluarga (KK)",
  kia: "KIA",
  rapor: "Rapor",
  akta: "Akta Kelahiran",
};

/** @deprecated gunakan tournament.minPlayerDocuments / kartu wajib */
export const MIN_PLAYER_DOCUMENTS = 2;

/** Kapasitas pendaftaran turnamen (bukan ukuran bagan 2ⁿ). */
export type TournamentMaxTeams = number;

export function nextPowerOf2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function isPowerOf2(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0;
}

export function hasMinimumPlayerDocuments(
  documents: { docType: string }[],
  minimum: number = MIN_PLAYER_DOCUMENTS
): boolean {
  const uniqueTypes = new Set(documents.map((d) => d.docType));
  return uniqueTypes.size >= minimum;
}

/**
 * Ukuran bagan knockout = 2ⁿ terdekat ≥ confirmed.
 * Boleh lebih besar dari maxTeams jika kapasitas bukan power-of-2
 * (mis. 15 tim → bagan 16 + 1 BYE).
 */
export function computeBracketSize(
  confirmedCount: number,
  maxTeams: number
): number {
  if (confirmedCount < 2) {
    throw new Error("Minimal 2 tim untuk membuat bagan");
  }
  if (confirmedCount > maxTeams) {
    throw new Error(
      `Jumlah tim confirmed (${confirmedCount}) melebihi kapasitas ${maxTeams}`
    );
  }

  const needed = nextPowerOf2(confirmedCount);

  if (needed > maxTeams && isPowerOf2(maxTeams)) {
    throw new Error(
      `Butuh bagan ${needed} tapi kapasitas turnamen hanya ${maxTeams}`
    );
  }

  if (needed > 64) {
    throw new Error(`Ukuran bagan ${needed} melebihi batas 64.`);
  }

  return needed;
}
