"use server";

import { revalidatePath } from "next/cache";
import { requireSelectedTournament } from "@/lib/admin-tournament";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase/admin";

export type ManagerActionState = {
  error?: string;
  success?: string;
  /** Password sementara (hanya sekali tampil setelah set) */
  tempPassword?: string;
  /** Tautan recovery untuk dikirim manual ke manajer */
  recoveryLink?: string;
};

function randomTempPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function assertCaptainInSelectedTournament(userId: string) {
  const tournament = await requireSelectedTournament();
  const team = await prisma.team.findFirst({
    where: { tournamentId: tournament.id, captainId: userId },
    select: { id: true, name: true },
  });
  if (!team) {
    return { error: "Manajer tidak terdaftar di turnamen aktif." } as const;
  }
  return { tournament, team } as const;
}

/** Admin set password sementara untuk manajer (service role). */
export async function adminSetManagerPassword(
  _prev: ManagerActionState,
  formData: FormData
): Promise<ManagerActionState> {
  await requireRole("admin");
  const userId = String(formData.get("user_id") ?? "").trim();
  const custom = String(formData.get("password") ?? "").trim();

  if (!userId) return { error: "User tidak valid." };

  const check = await assertCaptainInSelectedTournament(userId);
  if ("error" in check) return { error: check.error };

  const password = custom || randomTempPassword(10);
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const service = createServiceClient();
  if (!service) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. Tidak bisa reset password dari panel.",
    };
  }

  const { error } = await service.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) {
    return { error: `Gagal set password: ${error.message}` };
  }

  revalidatePath("/admin/manajer");
  return {
    success: `Password sementara untuk tim "${check.team.name}" sudah diset. Berikan ke manajer, lalu minta ganti setelah login.`,
    tempPassword: password,
  };
}

/** Buat tautan recovery (admin salin & kirim via WA/email). */
export async function adminCreateManagerRecoveryLink(
  _prev: ManagerActionState,
  formData: FormData
): Promise<ManagerActionState> {
  await requireRole("admin");
  const userId = String(formData.get("user_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!userId || !email) return { error: "Data manajer tidak lengkap." };

  const check = await assertCaptainInSelectedTournament(userId);
  if ("error" in check) return { error: check.error };

  const service = createServiceClient();
  if (!service) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. Tidak bisa buat tautan reset.",
    };
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  const redirectTo = site
    ? `${site.replace(/\/$/, "")}/login`
    : undefined;

  const { data, error } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });

  if (error) {
    return { error: `Gagal buat tautan: ${error.message}` };
  }

  const link = data.properties?.action_link ?? "";

  if (!link) {
    return { error: "Tautan reset tidak tersedia dari Supabase." };
  }

  revalidatePath("/admin/manajer");
  return {
    success: `Tautan reset untuk "${check.team.name}" siap. Salin dan kirim ke manajer.`,
    recoveryLink: link,
  };
}
