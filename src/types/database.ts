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

export type TournamentMaxTeams = 8 | 16 | 32;

export function hasMinimumPlayerDocuments(
  documents: { docType: string }[],
  minimum: number = MIN_PLAYER_DOCUMENTS
): boolean {
  const uniqueTypes = new Set(documents.map((d) => d.docType));
  return uniqueTypes.size >= minimum;
}

export function computeBracketSize(
  confirmedCount: number,
  maxTeams: TournamentMaxTeams
): TournamentMaxTeams {
  if (confirmedCount < 2) {
    throw new Error("Minimal 2 tim untuk membuat bagan");
  }
  const needed = [8, 16, 32].find((n) => n >= confirmedCount) as
    | TournamentMaxTeams
    | undefined;
  if (!needed) {
    throw new Error(`Jumlah tim melebihi kapasitas ${maxTeams}`);
  }
  if (needed > maxTeams) {
    throw new Error(
      `Butuh bagan ${needed} tapi kapasitas turnamen hanya ${maxTeams}`
    );
  }
  return needed;
}
