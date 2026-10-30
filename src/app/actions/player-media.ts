"use server";

import { getSelectedTournamentId } from "@/lib/admin-tournament";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SIGNED_TTL_SEC = 3600;

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

async function signPath(path: string): Promise<string | null> {
  const service = createServiceClient();
  const supabase = service ?? (await createClient());
  const { data } = await supabase.storage
    .from("player-docs")
    .createSignedUrl(path, SIGNED_TTL_SEC);
  return data?.signedUrl ?? null;
}

/** Signed URL on-demand — hindari generate massal di halaman admin. */
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
    const url = await signPath(player.photoPath);
    return url ? { url } : { error: "Gagal membuat tautan foto." };
  }

  if (!documentId) return { error: "Berkas tidak valid." };
  const doc = await prisma.playerDocument.findFirst({
    where: { id: documentId, playerId, player: { teamId } },
    select: { filePath: true },
  });
  if (!doc) return { error: "Berkas tidak ditemukan." };

  const url = await signPath(doc.filePath);
  return url ? { url } : { error: "Gagal membuat tautan berkas." };
}
