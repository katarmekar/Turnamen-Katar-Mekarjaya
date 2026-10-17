"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  ensureDefaultDocCards,
  slugifyDocKey,
} from "@/lib/doc-cards";
import { prisma } from "@/lib/prisma";
import { requireSelectedTournament } from "@/lib/admin-tournament";

export type ActionState = { error?: string; success?: string };

export async function saveDocCard(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const keyRaw = String(formData.get("key") ?? "").trim();
  const required =
    formData.get("required") === "on" || formData.get("required") === "true";
  // checkbox "tampil" — jika tidak dikirim = nonaktif (saat edit)
  const activeRaw = formData.getAll("active").map(String);
  const active = id
    ? activeRaw.includes("true") || activeRaw.includes("on")
    : true;
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!label) return { error: "Nama kartu wajib diisi." };

  const key = slugifyDocKey(keyRaw || label);
  if (!key) return { error: "Kode kartu tidak valid." };

  try {
    if (id) {
      await prisma.tournamentDocCard.update({
        where: { id },
        data: {
          label,
          description: description || null,
          required,
          active,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
          // key tidak diubah saat edit agar dokumen lama tetap cocok
        },
      });
    } else {
      await prisma.tournamentDocCard.create({
        data: {
          tournamentId: tournament.id,
          key,
          label,
          description: description || null,
          required,
          active: true,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });
    }
  } catch (e) {
    console.error("saveDocCard", e);
    return {
      error:
        e instanceof Error && e.message.includes("Unique")
          ? "Kode kartu sudah dipakai."
          : "Gagal menyimpan kartu.",
    };
  }

  revalidatePath("/admin/dokumen");
  revalidatePath("/dashboard/pemain");
  return { success: id ? "Kartu diperbarui." : "Kartu ditambahkan." };
}

export async function deleteDocCard(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Kartu tidak valid." };

  await prisma.tournamentDocCard.deleteMany({
    where: { id, tournamentId: tournament.id },
  });

  revalidatePath("/admin/dokumen");
  revalidatePath("/dashboard/pemain");
  return { success: "Kartu dihapus." };
}

export async function seedDefaultDocCards(): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  await ensureDefaultDocCards(tournament.id);
  revalidatePath("/admin/dokumen");
  return { success: "Kartu default ditambahkan (jika belum ada)." };
}

export async function saveMinPlayerDocuments(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const min = Number(formData.get("min_player_documents") ?? 2);
  if (!Number.isFinite(min) || min < 0 || min > 20) {
    return { error: "Minimal dokumen 0–20." };
  }

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { minPlayerDocuments: min },
  });

  revalidatePath("/admin/dokumen");
  revalidatePath("/dashboard/pemain");
  return { success: "Syarat minimal berkas disimpan." };
}
