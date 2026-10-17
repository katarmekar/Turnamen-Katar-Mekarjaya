"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { ensureDefaultDocCards } from "@/lib/doc-cards";
import { ensureDefaultPlayerFields } from "@/lib/player-fields";
import { ADMIN_TOURNAMENT_COOKIE } from "@/lib/admin-tournament";
import { generateCompetition, submitMatchResult } from "@/lib/bracket";
import { prisma } from "@/lib/prisma";

export type ActionState = { error?: string; success?: string };

/** Pilih turnamen aktif untuk panel admin. */
export async function selectTournament(formData: FormData): Promise<void> {
  await requireRole("admin");
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  if (!tournamentId) {
    redirect("/admin/pilih");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true },
  });
  if (!tournament) {
    redirect("/admin/pilih");
  }

  const jar = await cookies();
  jar.set(ADMIN_TOURNAMENT_COOKIE, tournament.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 60,
  });

  revalidatePath("/admin");
  redirect("/admin/panel");
}

/** Hapus pilihan turnamen (kembali ke hub). */
export async function clearSelectedTournament(): Promise<void> {
  await requireRole("admin");
  const jar = await cookies();
  jar.delete(ADMIN_TOURNAMENT_COOKIE);
  revalidatePath("/admin");
  redirect("/admin");
}

/** Hapus turnamen beserta data terkait (tim, bagan, jadwal). */
export async function deleteTournament(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournamentId = String(formData.get("tournament_id") ?? "").trim();
  const confirmName = String(formData.get("confirm_name") ?? "").trim();

  if (!tournamentId) return { error: "Turnamen tidak valid." };

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, name: true },
  });
  if (!tournament) return { error: "Turnamen tidak ditemukan." };

  if (confirmName !== tournament.name) {
    return {
      error: `Ketik ulang nama turnamen persis: "${tournament.name}"`,
    };
  }

  await prisma.tournament.delete({ where: { id: tournamentId } });

  const jar = await cookies();
  if (jar.get(ADMIN_TOURNAMENT_COOKIE)?.value === tournamentId) {
    jar.delete(ADMIN_TOURNAMENT_COOKIE);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pilih");
  revalidatePath("/admin/turnamen");
  revalidatePath("/admin/panel");
  revalidatePath("/bagan");
  revalidatePath("/");

  return { success: `Turnamen "${tournament.name}" dihapus.` };
}

export async function confirmPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("admin");
  const teamId = String(formData.get("team_id") ?? "");
  const paymentId = String(formData.get("payment_id") ?? "");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { tournament: true },
  });
  if (!team) return { error: "Tim tidak ditemukan." };

  const confirmedCount = await prisma.team.count({
    where: { tournamentId: team.tournamentId, status: "confirmed" },
  });
  if (
    team.status !== "confirmed" &&
    confirmedCount >= team.tournament.maxTeams
  ) {
    return { error: "Slot turnamen sudah penuh." };
  }

  await prisma.$transaction(async (tx) => {
    if (paymentId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { reviewedBy: admin.id, reviewedAt: new Date() },
      });
    }
    await tx.team.update({
      where: { id: teamId },
      data: {
        status: "confirmed",
        confirmedAt: new Date(),
        rejectionNote: null,
      },
    });
  });

  revalidatePath("/admin/pembayaran");
  revalidatePath("/dashboard/tim");
  revalidatePath("/bagan");
  return { success: "Pembayaran dikonfirmasi. Tim masuk daftar confirmed." };
}

export async function rejectPayment(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("admin");
  const teamId = String(formData.get("team_id") ?? "");
  const paymentId = String(formData.get("payment_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  await prisma.$transaction(async (tx) => {
    if (paymentId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          note: note || "Ditolak",
        },
      });
    }
    await tx.team.update({
      where: { id: teamId },
      data: {
        status: "rejected",
        rejectionNote: note || "Bukti pembayaran ditolak.",
      },
    });
  });

  revalidatePath("/admin/pembayaran");
  revalidatePath("/dashboard/tim");
  return { success: "Pembayaran ditolak. Kapten dapat upload ulang." };
}

export async function saveTournament(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const maxTeams = Number(formData.get("max_teams") ?? 16);
  const fee = Number(formData.get("registration_fee") ?? 0);
  const bankName = String(formData.get("bank_name") ?? "").trim();
  const bankAccountNumber = String(
    formData.get("bank_account_number") ?? ""
  ).trim();
  const bankAccountHolder = String(
    formData.get("bank_account_holder") ?? ""
  ).trim();
  const adminWhatsapp = String(formData.get("admin_whatsapp") ?? "").trim();
  const status = String(formData.get("status") ?? "open") as
    | "draft"
    | "open"
    | "ongoing"
    | "done";
  const competitionFormat = String(
    formData.get("competition_format") ?? "knockout"
  ) as "knockout" | "single_round_robin" | "double_round_robin";

  if (!name || ![8, 16, 32].includes(maxTeams)) {
    return { error: "Nama dan kapasitas (8/16/32) wajib valid." };
  }

  if (
    !["knockout", "single_round_robin", "double_round_robin"].includes(
      competitionFormat
    )
  ) {
    return { error: "Sistem kompetisi tidak valid." };
  }

  if (adminWhatsapp && !/^[\d+\s()-]{8,20}$/.test(adminWhatsapp)) {
    return { error: "Nomor WhatsApp admin tidak valid." };
  }

  const data = {
    name,
    description: description || null,
    maxTeams,
    registrationFee: fee,
    bankName: bankName || null,
    bankAccountNumber: bankAccountNumber || null,
    bankAccountHolder: bankAccountHolder || null,
    adminWhatsapp: adminWhatsapp || null,
    status,
    competitionFormat,
  };

  try {
    if (id) {
      await prisma.tournament.update({ where: { id }, data });
    } else {
      const created = await prisma.tournament.create({ data });
      await ensureDefaultDocCards(created.id);
      await ensureDefaultPlayerFields(created.id);
    }
  } catch (e) {
    console.error("saveTournament", e);
    return {
      error:
        e instanceof Error
          ? e.message
          : "Gagal menyimpan turnamen. Restart next dev lalu coba lagi.",
    };
  }

  revalidatePath("/admin/turnamen");
  revalidatePath("/admin");
  revalidatePath("/admin/pilih");
  revalidatePath("/admin/panel");
  revalidatePath("/");
  return { success: "Turnamen disimpan." };
}

export async function shuffleBracket(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournamentId = String(formData.get("tournament_id") ?? "");
  try {
    const result = await generateCompetition(tournamentId);
    revalidatePath("/admin/bagan");
    revalidatePath("/admin/jadwal");
    revalidatePath("/bagan");
    if ("mode" in result && result.mode) {
      return {
        success: `Jadwal sistem liga (${result.mode === "double_round_robin" ? "kompetisi penuh" : "setengah kompetisi"}): ${result.matchCount} pertandingan (${result.teamCount} tim). Tekan Tetapkan bagan jika sudah final.`,
      };
    }
    return {
      success: `Bagan sistem gugur ${result.bracketSize} dibuat (${result.teamCount} tim, ${result.byeCount} BYE). Tekan Tetapkan bagan jika sudah final.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal membuat bagan" };
  }
}

/** Kunci bagan setelah acak — tidak bisa diacak ulang sampai turnamen selesai. */
export async function lockBracket(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const tournamentId = String(formData.get("tournament_id") ?? "");

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { _count: { select: { matches: true, bracketSlots: true } } },
  });

  if (!tournament) return { error: "Turnamen tidak ditemukan." };
  if (tournament.bracketLocked) {
    return { error: "Bagan sudah ditetapkan / terkunci." };
  }
  if (
    tournament._count.matches < 1 &&
    tournament._count.bracketSlots < 1
  ) {
    return { error: "Acak bagan dulu sebelum menetapkan." };
  }
  if (tournament.status === "done") {
    return { error: "Turnamen sudah selesai." };
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      bracketLocked: true,
      status:
        tournament.status === "open" ? "ongoing" : tournament.status,
    },
  });

  revalidatePath("/admin/bagan");
  revalidatePath("/admin/jadwal");
  revalidatePath("/bagan");
  return {
    success:
      "Bagan ditetapkan dan terkunci. Tidak bisa diacak ulang sampai pertandingan selesai.",
  };
}

export async function updateMatchSchedule(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("admin");
  const matchId = String(formData.get("match_id") ?? "");
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  const venue = String(formData.get("venue") ?? "").trim();

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      venue: venue || null,
    },
  });

  revalidatePath("/admin/jadwal");
  revalidatePath("/bagan");
  return { success: "Jadwal disimpan." };
}

export async function submitScore(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireRole("admin");
  const matchId = String(formData.get("match_id") ?? "");
  const resultType = String(formData.get("result_type") ?? "score") as
    | "score"
    | "wo"
    | "dq";
  const winnerTeamId = String(formData.get("winner_team_id") ?? "");
  const scoreA = formData.get("score_a");
  const scoreB = formData.get("score_b");
  const forfeitedTeamId = String(formData.get("forfeited_team_id") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await submitMatchResult({
      matchId,
      resultType,
      winnerTeamId: winnerTeamId || null,
      scoreA: scoreA !== null && scoreA !== "" ? Number(scoreA) : null,
      scoreB: scoreB !== null && scoreB !== "" ? Number(scoreB) : null,
      forfeitedTeamId,
      notes: notes || null,
      adminId: admin.id,
    });
    revalidatePath("/admin/jadwal");
    revalidatePath("/bagan");
    return { success: "Hasil pertandingan disimpan." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal simpan skor" };
  }
}
