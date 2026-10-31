"use server";

import { getSelectedTournamentId } from "@/lib/admin-tournament";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signPlayerDocPath } from "@/lib/player-docs-signed";

async function canAccessTeam(teamId: string): Promise<boolean> {
  const profile = await requireProfile();
  if (profile.role === "admin") {
    const selectedId = await getSelectedTournamentId();
    if (!selectedId) return false;
    const team = await prisma.team.findFirst({
      where: { id: teamId, tournamentId: selectedId },
      select: { id: true },
    });
    return !!team;
  }
  const team = await prisma.team.findFirst({
    where: { id: teamId, captainId: profile.id },
    select: { id: true },
  });
  return !!team;
}

/** Signed URL on-demand — untuk preview klik; thumbnail diisi batch di roster. */
export async function getPlayerMediaSignedUrl(input: {
  teamId: string;
  playerId: string;
  kind: "photo" | "document";
  documentId?: string;
}): Promise<{ url?: string; error?: string }> {
  const { teamId, playerId, kind, documentId } = input;
  if (!teamId || !playerId) {
    return { error: "Data tidak valid." };
  }
  if (!(await canAccessTeam(teamId))) {
    return { error: "Tidak diizinkan." };
  }

  if (kind === "photo") {
    const player = await prisma.player.findFirst({
      where: { id: playerId, teamId },
      select: { photoPath: true },
    });
    if (!player) return { error: "Pemain tidak ditemukan." };
    if (!player.photoPath) return { error: "Foto belum diunggah." };
    const url = await signPlayerDocPath(player.photoPath);
    return url ? { url } : { error: "Gagal membuat tautan foto." };
  }

  if (!documentId) return { error: "Berkas tidak valid." };
  const doc = await prisma.playerDocument.findFirst({
    where: { id: documentId, playerId, player: { teamId } },
    select: { filePath: true },
  });
  if (!doc) return { error: "Berkas tidak ditemukan." };

  const url = await signPlayerDocPath(doc.filePath);
  return url ? { url } : { error: "Gagal membuat tautan berkas." };
}
