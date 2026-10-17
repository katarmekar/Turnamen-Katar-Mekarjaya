"use server";

import { revalidatePath } from "next/cache";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import {
  ensureDefaultPlayerFields,
  isBuiltinPlayerFieldKey,
  normalizePlayerFieldType,
  slugifyFieldKey,
} from "@/lib/player-fields";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string; success?: string };

export async function savePlayerField(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();

  const id = String(formData.get("id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const placeholder = String(formData.get("placeholder") ?? "").trim();
  const keyRaw = String(formData.get("key") ?? "").trim();
  const fieldType = normalizePlayerFieldType(
    String(formData.get("field_type") ?? "text").trim()
  );
  const required =
    formData.get("required") === "on" || formData.get("required") === "true";
  const activeRaw = formData.getAll("active").map(String);
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!label) return { error: "Label field wajib diisi." };

  try {
    if (id) {
      const existing = await prisma.tournamentPlayerField.findFirst({
        where: { id, tournamentId: tournament.id },
      });
      if (!existing) return { error: "Field tidak ditemukan." };

      const active = existing.locked
        ? true
        : activeRaw.includes("true") || activeRaw.includes("on");
      const req = existing.locked ? true : required;

      await prisma.tournamentPlayerField.update({
        where: { id },
        data: {
          label,
          placeholder: placeholder || null,
          fieldType: existing.key === "jersey_number" ? "number" : fieldType,
          required: req,
          active,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });
    } else {
      const key = slugifyFieldKey(keyRaw || label);
      if (!key) return { error: "Kode field tidak valid." };
      if (isBuiltinPlayerFieldKey(key)) {
        return { error: "Kode field bawaan sudah dipakai." };
      }

      await prisma.tournamentPlayerField.create({
        data: {
          tournamentId: tournament.id,
          key,
          label,
          placeholder: placeholder || null,
          fieldType,
          required,
          locked: false,
          active: true,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });
    }
  } catch (e) {
    console.error("savePlayerField", e);
    return {
      error:
        e instanceof Error && e.message.includes("Unique")
          ? "Kode field sudah dipakai."
          : "Gagal menyimpan field.",
    };
  }

  revalidatePath("/admin/form-pemain");
  revalidatePath("/dashboard/pemain");
  return { success: id ? "Field diperbarui." : "Field ditambahkan." };
}

export async function deletePlayerField(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Field tidak valid." };

  const existing = await prisma.tournamentPlayerField.findFirst({
    where: { id, tournamentId: tournament.id },
  });
  if (!existing) return { error: "Field tidak ditemukan." };
  if (existing.locked) {
    return { error: "Field Nama lengkap tidak bisa dihapus." };
  }

  await prisma.tournamentPlayerField.delete({ where: { id } });
  revalidatePath("/admin/form-pemain");
  revalidatePath("/dashboard/pemain");
  return { success: "Field dihapus." };
}

/** Dipakai sebagai <form action> — harus Promise<void>, bukan ActionState. */
export async function seedDefaultPlayerFields(
  _formData?: FormData
): Promise<void> {
  await requireRole("admin");
  const tournament = await requireSelectedTournament();
  await ensureDefaultPlayerFields(tournament.id);
  revalidatePath("/admin/form-pemain");
}
