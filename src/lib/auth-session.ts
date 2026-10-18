/** Durasi sesi login absolut (detik) — user harus login ulang setelah ini. */
export const SESSION_MAX_AGE = 60 * 60 * 6; // 6 jam

/** Timestamp ms kapan sesi dimulai (hanya di-set saat login/register). */
export const SESSION_STARTED_COOKIE = "tb_session_started";

export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_MAX_AGE,
};

/** Opsi cookie untuk client Supabase SSR (selaras 6 jam). */
export const supabaseCookieOptions = {
  maxAge: SESSION_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
};

export function isSessionExpired(startedAtMs: number, now = Date.now()): boolean {
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return true;
  return now - startedAtMs >= SESSION_MAX_AGE * 1000;
}
