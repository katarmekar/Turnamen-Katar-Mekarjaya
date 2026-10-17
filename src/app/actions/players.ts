"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireProfile } from "@/lib/auth";
import { playerDocsSatisfied } from "@/lib/doc-cards";
import { isBuiltinPlayerFieldKey } from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";
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

const ROSTER_LOCKED_MESSAGE =
  "Bagan sudah ditetapkan. Data pemain tidak bisa ditambah, diubah, atau dihapus.";

function rosterLockedMessage(team: {
  tournament: { bracketLocked: boolean };
}): string | null {
  return team.tournament.bracketLocked ? ROSTER_LOCKED_MESSAGE : null;
}

async function getConfirmedTeam(captainId: string, teamId: string) {
  return prisma.team.findFirst({
    where: { id: teamId, captainId, status: "confirmed" },
    include: {
      tournament: {
        include: {
          docCards: { orderBy: { sortOrder: "asc" } },
          playerFields: { orderBy: { sortOrder: "asc" } },
        },
      },
      players: true,
    },
  });
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
  const profile = await requireProfile();
  const teamId = String(formData.get("team_id") ?? "");

  if (!teamId) {
    return { error: "Tim tidak valid." };
  }

  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) {
    return { error: "Tim belum dikonfirmasi atau tidak ditemukan." };
  }

  const locked = rosterLockedMessage(team);
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

  revalidatePath("/dashboard/pemain");
  revalidatePath("/dashboard");
  return {
    success: "Pemain disimpan. Lanjut upload berkas.",
    playerId: player.id,
  };
}

export async function updatePlayer(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");

  if (!teamId || !playerId) {
    return { error: "Data tidak valid." };
  }

  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) {
    return { error: "Tim belum dikonfirmasi atau tidak ditemukan." };
  }

  const locked = rosterLockedMessage(team);
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

  revalidatePath("/dashboard/pemain");
  revalidatePath("/dashboard");
  return { success: "Data pemain diperbarui.", playerId };
}

export async function deletePlayerAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  const teamId = String(formData.get("team_id") ?? "");
  const playerId = String(formData.get("player_id") ?? "");

  if (!teamId || !playerId) {
    return { error: "Data tidak valid." };
  }

  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) {
    return { error: "Tidak diizinkan." };
  }

  const locked = rosterLockedMessage(team);
  if (locked) return { error: locked };

  await prisma.player.deleteMany({
    where: { id: playerId, teamId },
  });
  revalidatePath("/dashboard/pemain");
  return { success: "Pemain dihapus." };
}

export async function deletePlayer(playerId: string, teamId: string) {
  const profile = await requireProfile();
  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) throw new Error("Tidak diizinkan");

  const locked = rosterLockedMessage(team);
  if (locked) throw new Error(locked);

  await prisma.player.deleteMany({
    where: { id: playerId, teamId },
  });
  revalidatePath("/dashboard/pemain");
}

export async function uploadPlayerDocument(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
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

  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) return { error: "Tim belum dikonfirmasi." };

  const locked = rosterLockedMessage(team);
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

  revalidatePath("/dashboard/pemain");
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
  const profile = await requireProfile();
  const teamId = String(formData.get("team_id") ?? "");
  if (!teamId) return { error: "Tim tidak valid." };

  const team = await getConfirmedTeam(profile.id, teamId);
  if (!team) {
    return { error: "Tim belum dikonfirmasi atau tidak ditemukan." };
  }

  const locked = rosterLockedMessage(team);
  if (locked) return { error: locked };

  if (team.players.length >= team.tournament.maxPlayersPerTeam) {
    return {
      error: `Maksimal ${team.tournament.maxPlayersPerTeam} pemain per tim.`,
    };
  }

  const allowed = team.tournament.docCards.filter((c) => c.active);
  const requiredCards = allowed.filter((c) => c.required);
  const minNeeded =
    requiredCards.length > 0
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

  if (requiredCards.length > 0) {
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

  revalidatePath("/dashboard/pemain");
  revalidatePath("/dashboard");
  return {
    playerId: player.id,
    success: `Pemain ${parsed.data.fullName} dan ${docs.length} berkas berhasil disimpan.`,
  };
}
