"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isBlankRulesHtml,
  sanitizeRulesHtml,
} from "@/lib/rules-html";
import {
  bumpTournamentRulesVersion,
  replaceTournamentRulesFromDefault,
} from "@/lib/tournament-rules";

export type ActionState = { error?: string; success?: string };

function revalidateRules() {
  revalidatePath("/admin/peraturan");
  revalidatePath("/admin/panel");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/peraturan");
}

export async function saveTournamentRulesHeader(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const eyebrow = String(formData.get("header_eyebrow") ?? "")
    .trim()
    .slice(0, 80);
  const title = String(formData.get("header_title") ?? "")
    .trim()
    .slice(0, 160);
  const subtitle = String(formData.get("header_subtitle") ?? "")
    .trim()
    .slice(0, 400);
  const metaRaw = String(formData.get("header_meta") ?? "")
    .trim()
    .slice(0, 200);

  if (!title) return { error: "Judul dokumen wajib diisi." };

  const existing = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournament.id },
    select: {
      name: true,
      rulesVersion: true,
      rulesHeaderEyebrow: true,
      rulesHeaderTitle: true,
      rulesHeaderSubtitle: true,
      rulesHeaderMeta: true,
    },
  });

  const autoMeta = `${existing.name} · Versi ${existing.rulesVersion}`;
  const meta = !metaRaw || metaRaw === autoMeta ? "" : metaRaw;

  const changed =
    existing.rulesHeaderEyebrow !== eyebrow ||
    existing.rulesHeaderTitle !== title ||
    existing.rulesHeaderSubtitle !== subtitle ||
    existing.rulesHeaderMeta !== meta;

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      rulesHeaderEyebrow: eyebrow || "Dokumen resmi",
      rulesHeaderTitle: title,
      rulesHeaderSubtitle: subtitle,
      rulesHeaderMeta: meta,
    },
  });

  if (changed) await bumpTournamentRulesVersion(tournament.id);
  revalidateRules();
  return {
    success: changed
      ? "Header disimpan. Manajer harus menyetujui ulang."
      : "Tidak ada perubahan.",
  };
}

export async function saveTournamentRule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const pasalNumber = Number(formData.get("pasal_number") ?? 0);
  const bodyHtml = sanitizeRulesHtml(
    String(formData.get("body_html") ?? "")
  );

  if (!Number.isInteger(pasalNumber) || pasalNumber < 1 || pasalNumber > 999) {
    return { error: "Nomor pasal harus bilangan bulat 1–999." };
  }
  if (!title) return { error: "Judul peraturan wajib diisi." };
  if (isBlankRulesHtml(bodyHtml)) {
    return { error: "Isi pasal wajib diisi." };
  }

  const conflict = await prisma.tournamentRule.findFirst({
    where: {
      tournamentId: tournament.id,
      pasalNumber,
      ...(id ? { NOT: { id } } : {}),
    },
    select: { id: true },
  });
  if (conflict) {
    return { error: `Nomor pasal ${pasalNumber} sudah dipakai pasal lain.` };
  }

  const emptyPoints = [] as unknown as Prisma.InputJsonValue;

  if (id) {
    const existing = await prisma.tournamentRule.findFirst({
      where: { id, tournamentId: tournament.id },
    });
    if (!existing) return { error: "Peraturan tidak ditemukan." };

    const changed =
      existing.pasalNumber !== pasalNumber ||
      existing.title !== title ||
      existing.description !== bodyHtml;

    await prisma.tournamentRule.update({
      where: { id },
      data: {
        pasalNumber,
        title,
        description: bodyHtml,
        points: emptyPoints,
      },
    });
    if (changed) await bumpTournamentRulesVersion(tournament.id);
    revalidateRules();
    return {
      success: changed
        ? "Pasal disimpan. Manajer harus menyetujui ulang."
        : "Tidak ada perubahan.",
    };
  }

  await prisma.tournamentRule.create({
    data: {
      tournamentId: tournament.id,
      pasalNumber,
      title,
      description: bodyHtml,
      points: emptyPoints,
    },
  });
  await bumpTournamentRulesVersion(tournament.id);
  revalidateRules();
  return { success: "Pasal ditambahkan. Manajer harus menyetujui ulang." };
}

export async function deleteTournamentRule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Peraturan tidak valid." };

  const existing = await prisma.tournamentRule.findFirst({
    where: { id, tournamentId: tournament.id },
  });
  if (!existing) return { error: "Peraturan tidak ditemukan." };

  await prisma.tournamentRule.delete({ where: { id } });
  await bumpTournamentRulesVersion(tournament.id);
  revalidateRules();
  return { success: "Pasal dihapus. Manajer harus menyetujui ulang." };
}

export async function seedDefaultTournamentRules(
  _formData?: FormData
): Promise<void> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  await replaceTournamentRulesFromDefault(tournament.id);
  revalidateRules();
}
