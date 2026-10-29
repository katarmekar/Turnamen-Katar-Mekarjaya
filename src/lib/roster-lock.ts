import { prisma } from "@/lib/prisma";

export const ROSTER_LOCKED_MESSAGE =
  "Jadwal pertandingan pertama sudah dimulai. Data pemain tidak bisa ditambah, diubah, atau dihapus.";

/** Terkunci jika waktu sekarang ≥ scheduledAt pertandingan paling awal di turnamen. */
export async function isRosterLocked(
  tournamentId: string,
  now = new Date()
): Promise<boolean> {
  const first = await prisma.match.findFirst({
    where: { tournamentId, scheduledAt: { not: null } },
    orderBy: { scheduledAt: "asc" },
    select: { scheduledAt: true },
  });
  return (
    !!first?.scheduledAt && first.scheduledAt.getTime() <= now.getTime()
  );
}

export async function rosterLockedMessage(
  tournamentId: string,
  now = new Date()
): Promise<string | null> {
  return (await isRosterLocked(tournamentId, now))
    ? ROSTER_LOCKED_MESSAGE
    : null;
}

/** Map tournamentId → terkunci, untuk beberapa turnamen sekaligus. */
export async function getRosterLockedMap(
  tournamentIds: string[],
  now = new Date()
): Promise<Map<string, boolean>> {
  const unique = [...new Set(tournamentIds)];
  const map = new Map<string, boolean>();
  for (const id of unique) map.set(id, false);
  if (unique.length === 0) return map;

  const matches = await prisma.match.findMany({
    where: {
      tournamentId: { in: unique },
      scheduledAt: { not: null },
    },
    orderBy: { scheduledAt: "asc" },
    select: { tournamentId: true, scheduledAt: true },
  });

  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.tournamentId) || !m.scheduledAt) continue;
    seen.add(m.tournamentId);
    map.set(m.tournamentId, m.scheduledAt.getTime() <= now.getTime());
  }
  return map;
}
