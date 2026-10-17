import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const ADMIN_TOURNAMENT_COOKIE = "tb_admin_tournament_id";

export async function getSelectedTournamentId(): Promise<string | null> {
  const jar = await cookies();
  const id = jar.get(ADMIN_TOURNAMENT_COOKIE)?.value?.trim();
  return id || null;
}

export async function getSelectedTournament() {
  const id = await getSelectedTournamentId();
  if (!id) return null;
  return prisma.tournament.findUnique({ where: { id } });
}

/**
 * Wajib ada turnamen terpilih. Kalau tidak / invalid → ke halaman pilih.
 */
export async function requireSelectedTournament() {
  const id = await getSelectedTournamentId();
  if (!id) redirect("/admin/pilih");

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) {
    redirect("/admin/pilih");
  }

  return tournament;
}
