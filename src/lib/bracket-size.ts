/**
 * Ukuran bagan 2^n.
 * Nilai ≤0 / tidak valid → 4 (hindari UI ambruk jadi CHAMPION saja).
 * Nilai 2 tetap diizinkan untuk final 2 tim yang sudah tergenerate.
 */
export function normalizeBracketSize(n: number) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 4;
  if (v <= 2) return 2;
  if (v <= 4) return 4;
  if (v <= 8) return 8;
  if (v <= 16) return 16;
  if (v <= 32) return 32;
  return 64;
}

/** Ukuran kerangka bagan (preview/skeleton): minimum SF→final (4). */
export function normalizePreviewBracketSize(n: number) {
  return Math.max(4, normalizeBracketSize(n <= 0 ? 4 : n));
}
