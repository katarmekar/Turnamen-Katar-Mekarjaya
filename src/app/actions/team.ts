"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPrivateFile } from "@/lib/supabase/storage-upload";

export type ActionState = { error?: string; success?: string };

export async function registerTeam(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "captain") {
    return { error: "Hanya manajer yang dapat mendaftarkan tim." };
  }

  const tournamentId = String(formData.get("tournament_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  const coachName = String(formData.get("coach_name") ?? "").trim();
  const logo = formData.get("logo") as File | null;

  if (!tournamentId || !name) {
    return { error: "Nama tim dan turnamen wajib diisi." };
  }

  if (!city || !/^RW \d{2}$/.test(city)) {
    return { error: "Pilih RW (01–31)." };
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament || tournament.status !== "open") {
    return { error: "Pendaftaran turnamen ditutup." };
  }

  const confirmedCount = await prisma.team.count({
    where: { tournamentId, status: "confirmed" },
  });
  if (confirmedCount >= tournament.maxTeams) {
    return { error: "Slot turnamen sudah penuh." };
  }

  const existing = await prisma.team.findFirst({
    where: { tournamentId, captainId: profile.id },
  });
  if (existing) {
    return { error: "Anda sudah mendaftarkan tim di turnamen ini." };
  }

  let logoPath: string | null = null;
  const team = await prisma.team.create({
    data: {
      tournamentId,
      captainId: profile.id,
      name,
      city: city || null,
      contactPhone: contactPhone || profile.phone,
      contactEmail: null,
      coachName: coachName || null,
      status: "pending_payment",
    },
  });

  if (logo && logo.size > 0) {
    const ext = logo.name.split(".").pop() || "png";
    const path = `${team.id}/logo.${ext}`;
    const uploaded = await uploadPrivateFile({
      bucket: "team-logos",
      path,
      file: logo,
      upsert: true,
    });
    if (!("error" in uploaded)) {
      logoPath = uploaded.path;
      await prisma.team.update({
        where: { id: team.id },
        data: { logoPath },
      });
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/tim?registered=1&teamId=${team.id}`);
}

/**
 * Simpan meta bukti setelah file di-upload dari browser (JWT user → Storage RLS).
 */
export async function savePaymentProofMeta(params: {
  teamId: string;
  proofPath: string;
  note?: string;
}): Promise<ActionState> {
  const profile = await requireProfile();
  const teamId = params.teamId.trim();
  const proofPath = params.proofPath.trim();
  const note = (params.note ?? "").trim();

  if (!teamId || !proofPath) {
    return { error: "Data upload tidak lengkap." };
  }

  // Path harus di folder team id milik manajer
  if (!proofPath.startsWith(`${teamId}/`)) {
    return { error: "Path bukti tidak valid." };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, captainId: profile.id },
    include: { tournament: true },
  });

  if (!team) return { error: "Tim tidak ditemukan." };
  if (!["pending_payment", "rejected", "awaiting_confirm"].includes(team.status)) {
    return { error: "Status tim tidak memungkinkan upload bukti." };
  }

  await prisma.payment.create({
    data: {
      teamId: team.id,
      proofPath,
      amount: team.tournament.registrationFee,
      note: note || null,
    },
  });

  await prisma.team.update({
    where: { id: team.id },
    data: {
      status: "awaiting_confirm",
      rejectionNote: null,
    },
  });

  revalidatePath("/dashboard/tim");
  revalidatePath("/admin/pembayaran");
  return { success: "Bukti transfer terkirim. Menunggu konfirmasi admin." };
}

/** @deprecated pakai PaymentProofUpload + savePaymentProofMeta */
export async function uploadPaymentProof(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  const teamId = String(formData.get("team_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const file = formData.get("proof") as File | null;

  if (!teamId || !file || file.size === 0) {
    return { error: "Pilih file bukti transfer." };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, captainId: profile.id },
    include: { tournament: true },
  });

  if (!team) return { error: "Tim tidak ditemukan." };
  if (!["pending_payment", "rejected", "awaiting_confirm"].includes(team.status)) {
    return { error: "Status tim tidak memungkinkan upload bukti." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${team.id}/${Date.now()}.${ext}`;

  const uploaded = await uploadPrivateFile({
    bucket: "payment-proofs",
    path,
    file,
    upsert: false,
  });
  if ("error" in uploaded) {
    return { error: `Gagal upload: ${uploaded.error}` };
  }

  return savePaymentProofMeta({
    teamId: team.id,
    proofPath: uploaded.path,
    note,
  });
}

/** Manajer menyetujui peraturan turnamen (versi saat ini). */
export async function acceptTournamentRules(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profile = await requireProfile();
  if (profile.role !== "captain") {
    return { error: "Hanya manajer yang dapat menyetujui peraturan." };
  }

  const teamId = String(formData.get("team_id") ?? "").trim();
  const agreed = String(formData.get("agreed") ?? "") === "1";

  if (!teamId) return { error: "Tim tidak valid." };
  if (!agreed) {
    return { error: "Centang pernyataan setuju terlebih dahulu." };
  }

  const team = await prisma.team.findFirst({
    where: { id: teamId, captainId: profile.id },
    include: {
      tournament: {
        select: { id: true, rulesVersion: true },
      },
    },
  });

  if (!team) return { error: "Tim tidak ditemukan." };

  await prisma.team.update({
    where: { id: team.id },
    data: {
      rulesAcceptedVersion: team.tournament.rulesVersion,
      rulesAcceptedAt: new Date(),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/peraturan");
  return { success: "Peraturan disetujui. Jadwal pertandingan kini dapat dilihat." };
}
