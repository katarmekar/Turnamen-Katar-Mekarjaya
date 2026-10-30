"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSelectedTournamentId } from "@/lib/admin-tournament";
import { requireProfile } from "@/lib/auth";
import { playerDocsSatisfied } from "@/lib/doc-cards";
import { isBuiltinPlayerFieldKey } from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";
import { rosterLockedMessage } from "@/lib/roster-lock";
import { uploadPrivateFile } from "@/lib/supabase/storage-upload";

export type ActionState = {
  error?: string;
  success?: string;
  playerId?: string;
  docType?: string;
};

type ParsedPlayer = {
  fullName: string;
  identityNumber: string | null;
  jerseyNumber: number | null;
  position: string | null;
  extraData: Record<string, string>;
};

const teamMutationInclude = {
  tournament: {
    include: {
      docCards: { orderBy: { sortOrder: "asc" as const } },
      playerFields: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  players: true,
};

type TeamForMutation = Prisma.TeamGetPayload<{
  include: typeof teamMutationInclude;
}>;

/**
 * Manajer: hanya tim confirmed miliknya + kunci jadwal.
 * Admin: tim mana pun di turnamen terpilih, tanpa kunci jadwal.
 */
async function getTeamForMutation(teamId: string): Promise<
  | { ok: true; team: TeamForMutation; isAdmin: boolean }
  | { ok: false; error: string }
> {
  const profile = await requireProfile();

  if (profile.role === "admin") {
    const selectedId = await getSelectedTournamentId();
    if (!selectedId) {
      return { ok: false, error: "Pilih turnamen dulu di panel admin." };
    }
    const team = await prisma.team.findFirst({
      where: { id: teamId, tournamentId: selectedId },
      include: teamMutationInclude,
    });
    if (!team) {
      return {
        ok: false,
        error: "Tim tidak ditemukan di turnamen terpilih.",
      };
    }
    return { ok: true, team, isAdmin: true };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, captainId: profile.id, status: "confirmed" },
    include: teamMutationInclude,
  });
  if (!team) {
    return {
      ok: false,
      error: "Tim belum dikonfirmasi atau tidak ditemukan.",
    };
  }
  return { ok: true, team, isAdmin: false };
}

async function assertRosterEditable(
  team: { tournamentId: string },
  isAdmin: boolean
): Promise<string | null> {
  if (isAdmin) return null;
  return rosterLockedMessage(team.tournamentId);
}

function revalidatePlayerPaths(isAdmin: boolean) {
  revalidatePath("/dashboard/pemain");
  revalidatePath("/dashboard");
  if (isAdmin) {
    revalidatePath("/admin/pemain");
  }
}

function parsePlayerFromForm(
  formData: FormData,
  fields: {
    key: string;
    label: string;
    fieldType: string;
    required: boolean;
    active: boolean;
  }[]
): { data?: ParsedPlayer; error?: string } {
  const active = fields.filter((f) => f.active);
  const extraData: Record<string, string> = {};
  let fullName = "";
  let identityNumber: string | null = null;
  let jerseyNumber: number | null = null;
  let position: string | null = null;

  for (const field of active) {
    const raw = String(formData.get(`field_${field.key}`) ?? "").trim();
    if (field.required && !raw) {
      return { error: `${field.label} wajib diisi.` };
    }
    if (!raw) continue;

    if (field.fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return { error: `${field.label} harus tanggal yang valid.` };
    }
    if (field.fieldType === "number" && field.key !== "jersey_number") {
      if (!Number.isFinite(Number(raw))) {
        return { error: `${field.label} harus angka.` };
      }
    }

    if (field.key === "full_name") {
      fullName = raw;
    } else if (field.key === "identity_number") {
      identityNumber = raw;
    } else if (field.key === "jersey_number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        return { error: `${field.label} harus angka.` };
      }
      jerseyNumber = n;
    } else if (field.key === "position") {
      position = raw;
    } else if (!isBuiltinPlayerFieldKey(field.key)) {
      extraData[field.key] = raw;
    }
  }

  if (!fullName) {
    fullName = String(formData.get("field_full_name") ?? "").trim();
  }
  if (!fullName) {
    return { error: "Nama lengkap wajib diisi." };
  }

  return {
    data: {
      fullName,
      identityNumber,
      jerseyNumber,
      position,
      extraData,
    },
  };
}

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Upload foto pemain opsional. Return path baru, atau null jika tidak ada file. */
async function uploadOptionalPlayerPhoto(
  formData: FormData,
  teamId: string,
  playerId: string
): Promise<{ path?: string | null; error?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) {
    return { path: null };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Foto pemain harus berupa gambar." };
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return { error: "Foto pemain maksimal 5 MB." };
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";
  const path = `${teamId}/${playerId}/_photo.${safeExt}`;

  const uploaded = await uploadPrivateFile({
    bucket: "player-docs",
    path,
    file,
    upsert: true,
  });
  if ("error" in uploaded) {
    return { error: `Upload foto gagal: ${uploaded.error}` };
  }
  return { path };
}

export async function addPlayer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teamId = String(formData.get("team_id") ?? "");

  if (!teamId) {
    return { error: "Tim tidak valid." };
  }

  const access = await getTeamForMutation(teamId);
  if (!access.ok) return { error: access.error };
  const { team, isAdmin } = access;

  const locked = await assertRosterEditable(team, isAdmin);
  if (locked) return { error: locked };

  if (team.players.length >= team.tournament.maxPlayersPerTeam) {
    return {
      error: `Maksimal ${team.tournament.maxPlayersPerTeam} pemain per tim.`,
    };
  }

  const parsed = parsePlayerFromForm(
    formData,
    team.tournament.playerFields
  );
  if (parsed.error || !parsed.data) {
    return { error: parsed.error ?? "Data pemain tidak valid." };
  }

  const player = await prisma.player.create({
    data: {
      teamId,
      fullName: parsed.data.fullName,
      identityNumber: parsed.data.identityNumber,
      jerseyNumber: parsed.data.jerseyNumber,
      position: parsed.data.position,
      extraData:
        Object.keys(parsed.data.extraData).length > 0
          ? (parsed.data.extraData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  const photo = await uploadOptionalPlayerPhoto(formData, teamId, player.id);
  if (photo.error) {
    await prisma.player.delete({ where: { id: player.id } }).catch(() => {});
    return { error: photo.error };
  }
  if (photo.path) {
    await prisma.player.update({
      where: { id: player.id },
      data: { photoPath: photo.path },
    });
  }

  revalidatePlayerPaths(isAdmin);
  return {
    success: "Pemain disimpan. Lanjut upload berkas.",
    playerId: player.id,
  };
}

export async function updatePlayer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");

  if (!teamId || !playerId) {
    return { error: "Data tidak valid." };
  }

  const access = await getTeamForMutation(teamId);
  if (!access.ok) return { error: access.error };
  const { team, isAdmin } = access;

  const locked = await assertRosterEditable(team, isAdmin);
  if (locked) return { error: locked };

  const existing = await prisma.player.findFirst({
    where: { id: playerId, teamId },
  });
  if (!existing) {
    return { error: "Pemain tidak ditemukan." };
  }

  const parsed = parsePlayerFromForm(
    formData,
    team.tournament.playerFields
  );
  if (parsed.error || !parsed.data) {
    return { error: parsed.error ?? "Data pemain tidak valid." };
  }

  const photo = await uploadOptionalPlayerPhoto(formData, teamId, playerId);
  if (photo.error) {
    return { error: photo.error };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      fullName: parsed.data.fullName,
      identityNumber: parsed.data.identityNumber,
      jerseyNumber: parsed.data.jerseyNumber,
      position: parsed.data.position,
      extraData:
        Object.keys(parsed.data.extraData).length > 0
          ? (parsed.data.extraData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      ...(photo.path ? { photoPath: photo.path } : {}),
    },
  });

  revalidatePlayerPaths(isAdmin);
  return { success: "Data pemain diperbarui.", playerId };
}

export async function deletePlayerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");

  if (!teamId || !playerId) {
    return { error: "Data tidak valid." };
  }

  const access = await getTeamForMutation(teamId);
  if (!access.ok) return { error: access.error };

  const locked = await assertRosterEditable(access.team, access.isAdmin);
  if (locked) return { error: locked };

  await prisma.player.deleteMany({
    where: { id: playerId, teamId },
  });
  revalidatePlayerPaths(access.isAdmin);
  return { success: "Pemain dihapus." };
}

export async function deletePlayer(playerId: string, teamId: string) {
  const access = await getTeamForMutation(teamId);
  if (!access.ok) throw new Error(access.error);

  const locked = await assertRosterEditable(access.team, access.isAdmin);
  if (locked) throw new Error(locked);

  await prisma.player.deleteMany({
    where: { id: playerId, teamId },
  });
  revalidatePlayerPaths(access.isAdmin);
}

export async function uploadPlayerDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  const docType = String(formData.get("doc_type") ?? "").trim();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "Pilih file berkas." };
  }
  if (!playerId) {
    return { error: "Pemain belum disimpan." };
  }

  const access = await getTeamForMutation(teamId);
  if (!access.ok) return { error: access.error };
  const { team, isAdmin } = access;

  const locked = await assertRosterEditable(team, isAdmin);
  if (locked) return { error: locked };

  const allowed = team.tournament.docCards.filter((c) => c.active);
  const card = allowed.find((c) => c.key === docType);
  if (!card) {
    return { error: "Jenis berkas tidak valid untuk turnamen ini." };
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, teamId },
    include: { documents: true },
  });
  if (!player) return { error: "Pemain tidak ditemukan." };

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${teamId}/${playerId}/${docType}.${ext}`;

  const uploaded = await uploadPrivateFile({
    bucket: "player-docs",
    path,
    file,
    upsert: true,
  });
  if ("error" in uploaded) {
    return { error: `Upload gagal: ${uploaded.error}` };
  }

  await prisma.playerDocument.upsert({
    where: {
      playerId_docType: { playerId, docType },
    },
    create: { playerId, docType, filePath: path },
    update: { filePath: path },
  });

  const docs = await prisma.playerDocument.findMany({ where: { playerId } });
  const check = playerDocsSatisfied(
    docs,
    allowed,
    team.tournament.minPlayerDocuments
  );

  revalidatePlayerPaths(isAdmin);
  return {
    playerId,
    docType,
    success: check.ok
      ? "Berkas tersimpan. Syarat dokumen terpenuhi."
      : check.missingLabels.length
        ? `Berkas tersimpan. Masih kurang: ${check.missingLabels.join(", ")}.`
        : `Berkas tersimpan. Masih kurang — minimal ${check.needed} jenis dokumen.`,
  };
}

/** Simpan pemain (jika belum) lalu upload berkas dalam satu aksi. */
export async function savePlayerAndUploadDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  let playerId = String(formData.get("player_id") ?? "").trim();

  if (!playerId) {
    const created = await addPlayer(_prev, formData);
    if (created.error || !created.playerId) {
      return created;
    }
    playerId = created.playerId;
  }

  const uploadData = new FormData();
  for (const [k, v] of formData.entries()) {
    uploadData.append(k, v);
  }
  uploadData.set("player_id", playerId);

  const uploaded = await uploadPlayerDocument(_prev, uploadData);
  return {
    ...uploaded,
    playerId,
  };
}

/**
 * Buat pemain + upload banyak berkas sekaligus.
 * FormData: field_*, doc_count, doc_type_0..n, file_0..n
 */
export async function addPlayerWithDocuments(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const teamId = String(formData.get("team_id") ?? "");
  if (!teamId) return { error: "Tim tidak valid." };

  const access = await getTeamForMutation(teamId);
  if (!access.ok) return { error: access.error };
  const { team, isAdmin } = access;

  const locked = await assertRosterEditable(team, isAdmin);
  if (locked) return { error: locked };

  if (team.players.length >= team.tournament.maxPlayersPerTeam) {
    return {
      error: `Maksimal ${team.tournament.maxPlayersPerTeam} pemain per tim.`,
    };
  }

  const allowed = team.tournament.docCards.filter((c) => c.active);
  const requiredCards = allowed.filter((c) => c.required);
  // Admin boleh simpan tanpa berkas; manajer tetap wajib sesuai aturan turnamen.
  const minNeeded = isAdmin
    ? 0
    : requiredCards.length > 0
      ? requiredCards.length
      : Math.max(1, team.tournament.minPlayerDocuments);

  const docCount = Number(formData.get("doc_count") ?? 0);
  const docs: { docType: string; file: File }[] = [];
  for (let i = 0; i < docCount; i++) {
    const docType = String(formData.get(`doc_type_${i}`) ?? "").trim();
    const file = formData.get(`file_${i}`) as File | null;
    if (!docType || !file || file.size === 0) continue;
    if (!allowed.some((c) => c.key === docType)) {
      return { error: `Jenis berkas tidak valid: ${docType}` };
    }
    if (docs.some((d) => d.docType === docType)) {
      return { error: "Jenis kartu tidak boleh duplikat." };
    }
    docs.push({ docType, file });
  }

  if (docs.length < minNeeded) {
    return {
      error: `Minimal ${minNeeded} berkas harus diunggah sebelum menyimpan.`,
    };
  }

  if (!isAdmin && requiredCards.length > 0) {
    const missing = requiredCards.filter(
      (c) => !docs.some((d) => d.docType === c.key)
    );
    if (missing.length > 0) {
      return {
        error: `Kartu wajib belum lengkap: ${missing.map((c) => c.label).join(", ")}.`,
      };
    }
  }

  const parsed = parsePlayerFromForm(formData, team.tournament.playerFields);
  if (parsed.error || !parsed.data) {
    return { error: parsed.error ?? "Data pemain tidak valid." };
  }

  const player = await prisma.player.create({
    data: {
      teamId,
      fullName: parsed.data.fullName,
      identityNumber: parsed.data.identityNumber,
      jerseyNumber: parsed.data.jerseyNumber,
      position: parsed.data.position,
      extraData:
        Object.keys(parsed.data.extraData).length > 0
          ? (parsed.data.extraData as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  const photo = await uploadOptionalPlayerPhoto(formData, teamId, player.id);
  if (photo.error) {
    await prisma.player.delete({ where: { id: player.id } }).catch(() => {});
    return { error: photo.error };
  }
  if (photo.path) {
    await prisma.player.update({
      where: { id: player.id },
      data: { photoPath: photo.path },
    });
  }

  for (const doc of docs) {
    const ext = doc.file.name.split(".").pop() || "jpg";
    const path = `${teamId}/${player.id}/${doc.docType}.${ext}`;
    const uploaded = await uploadPrivateFile({
      bucket: "player-docs",
      path,
      file: doc.file,
      upsert: true,
    });
    if ("error" in uploaded) {
      await prisma.player.delete({ where: { id: player.id } }).catch(() => {});
      return { error: `Upload gagal (${doc.docType}): ${uploaded.error}` };
    }
    await prisma.playerDocument.create({
      data: {
        playerId: player.id,
        docType: doc.docType,
        filePath: path,
      },
    });
  }

  revalidatePlayerPaths(isAdmin);
  return {
    playerId: player.id,
    success:
      docs.length > 0
        ? `Pemain ${parsed.data.fullName} dan ${docs.length} berkas berhasil disimpan.`
        : `Pemain ${parsed.data.fullName} berhasil disimpan.`,
  };
}
