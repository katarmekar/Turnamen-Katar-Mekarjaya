import { prisma } from "@/lib/prisma";

/** Default kartu dokumen saat turnamen baru dibuat. */
export const DEFAULT_DOC_CARDS = [
  { key: "ktp", label: "KTP", required: false, sortOrder: 0 },
  { key: "kk", label: "Kartu Keluarga (KK)", required: false, sortOrder: 1 },
  { key: "kia", label: "KIA", required: false, sortOrder: 2 },
  { key: "rapor", label: "Rapor", required: false, sortOrder: 3 },
  { key: "akta", label: "Akta Kelahiran", required: false, sortOrder: 4 },
] as const;

export function slugifyDocKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export type DocCardLike = {
  key: string;
  label: string;
  required: boolean;
  active?: boolean;
};

export function playerDocsSatisfied(
  documents: { docType: string }[],
  cards: DocCardLike[],
  minFallback: number
): { ok: boolean; needed: number; have: number; missingLabels: string[] } {
  // active undefined → anggap aktif (kartu sudah difilter di server)
  const active = cards.filter((c) => c.active !== false);
  const uploaded = new Set(documents.map((d) => d.docType));
  const required = active.filter((c) => c.required);

  if (required.length > 0) {
    const missing = required.filter((c) => !uploaded.has(c.key));
    return {
      ok: missing.length === 0,
      needed: required.length,
      have: required.length - missing.length,
      missingLabels: missing.map((c) => c.label),
    };
  }

  const relevant = active.filter((c) => uploaded.has(c.key)).length;
  const needed = Math.max(1, minFallback);
  return {
    ok: relevant >= needed,
    needed,
    have: relevant,
    missingLabels: [],
  };
}

/** Seed kartu default jika turnamen belum punya konfigurasi dokumen. */
export async function ensureDefaultDocCards(tournamentId: string) {
  const count = await prisma.tournamentDocCard.count({
    where: { tournamentId },
  });
  if (count > 0) return;

  await prisma.tournamentDocCard.createMany({
    data: DEFAULT_DOC_CARDS.map((c) => ({
      tournamentId,
      key: c.key,
      label: c.label,
      required: c.required,
      sortOrder: c.sortOrder,
      active: true,
    })),
  });
}
