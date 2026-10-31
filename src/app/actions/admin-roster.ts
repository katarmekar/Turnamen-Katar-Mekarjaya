"use server";

import { getSelectedTournamentId } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { signPlayerDocPaths } from "@/lib/player-docs-signed";
import { prisma } from "@/lib/prisma";

export type AdminRosterPlayer = {
  id: string;
  fullName: string;
  identityNumber: string | null;
  jerseyNumber: number | null;
  position: string | null;
  hasPhoto: boolean;
  photoUrl: string | null;
  extraData: Record<string, string>;
  documents: { id: string; docType: string }[];
};

export type AdminTeamRosterResult =
  | { ok: true; players: AdminRosterPlayer[]; playerCount: number }
  | { ok: false; error: string };

/** Muat daftar pemain 1 tim — query tipis, label kartu diisi di client. */
export async function getAdminTeamRoster(
  teamId: string
): Promise<AdminTeamRosterResult> {
  await requireRole("admin");
  const selectedId = await getSelectedTournamentId();
  if (!selectedId) {
    return { ok: false, error: "Pilih turnamen dulu." };
  }
  if (!teamId) {
    return { ok: false, error: "Tim tidak valid." };
  }

  const players = await prisma.player.findMany({
    where: {
      teamId,
      team: { tournamentId: selectedId },
    },
    select: {
      id: true,
      fullName: true,
      identityNumber: true,
      jerseyNumber: true,
      position: true,
      photoPath: true,
      extraData: true,
      documents: {
        select: { id: true, docType: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Tim tidak ada / beda turnamen → 0 row; bedakan dari roster kosong
  if (players.length === 0) {
    const exists = await prisma.team.findFirst({
      where: { id: teamId, tournamentId: selectedId },
      select: { id: true },
    });
    if (!exists) {
      return { ok: false, error: "Tim tidak ditemukan di turnamen terpilih." };
    }
  }

  const photoUrls = await signPlayerDocPaths(
    players
      .map((player) => player.photoPath)
      .filter((path): path is string => Boolean(path))
  );

  return {
    ok: true,
    playerCount: players.length,
    players: players.map((player) => ({
      id: player.id,
      fullName: player.fullName,
      jerseyNumber: player.jerseyNumber,
      position: player.position,
      identityNumber: player.identityNumber,
      hasPhoto: Boolean(player.photoPath),
      photoUrl: player.photoPath
        ? (photoUrls.get(player.photoPath) ?? null)
        : null,
      extraData:
        player.extraData &&
        typeof player.extraData === "object" &&
        !Array.isArray(player.extraData)
          ? (player.extraData as Record<string, string>)
          : {},
      documents: player.documents.map((doc) => ({
        id: doc.id,
        docType: doc.docType,
      })),
    })),
  };
}
