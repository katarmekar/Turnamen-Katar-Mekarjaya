export function formatIdr(value: number | string | { toString(): string }) {
  const n = typeof value === "number" ? value : Number(value.toString());
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export const TEAM_STATUS_LABEL: Record<string, string> = {
  pending_payment: "Menunggu transfer",
  awaiting_confirm: "Menunggu konfirmasi admin",
  confirmed: "Pembayaran dikonfirmasi",
  rejected: "Bukti ditolak — upload ulang",
};

/** Label tampilan peran (nilai DB tetap captain/admin). */
export const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  captain: "Manajer",
};

export const RESULT_TYPE_LABEL: Record<string, string> = {
  score: "Skor",
  wo: "WO",
  dq: "Diskualifikasi",
};

export const COMPETITION_FORMAT_LABEL: Record<string, string> = {
  knockout: "Sistem gugur",
  single_round_robin: "Sistem liga — fase grup (1×)",
  double_round_robin: "Sistem liga — fase grup (2×)",
};

/** Normalisasi nomor HP Indonesia ke format wa.me (62...). */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (!digits.startsWith("62")) digits = `62${digits}`;
  return digits;
}

export function whatsappChatHref(
  phone: string | null | undefined,
  message: string
): string | null {
  const n = toWhatsappNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}
