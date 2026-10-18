import type { TeamStatus } from "@prisma/client";

/** Bukti ditolak: manajer harus upload ulang sebelum menu berikutnya. */
export function paymentReuploadRequired(status: TeamStatus) {
  return status === "rejected";
}

export function reuploadPaymentHref(teamId: string) {
  return `/dashboard/tim?teamId=${teamId}&wajib=1`;
}
