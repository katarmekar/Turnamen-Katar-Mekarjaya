/**
 * Hanya izinkan path relatif di-site (hindari open redirect seperti //evil.com).
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw) return fallback;
  const path = raw.trim();
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.includes("://")) return fallback;
  if (path.includes("\\")) return fallback;
  return path;
}
