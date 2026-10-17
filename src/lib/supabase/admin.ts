import { createClient } from "@supabase/supabase-js";

/**
 * Client service role — bypass RLS Storage.
 * Hanya dipakai di server setelah ownership dicek (Prisma/auth).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !key) {
    return null;
  }

  // Hindari pakai anon key tertukar sebagai service role
  if (key === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    console.error(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY sama dengan anon key — upload akan kena RLS."
    );
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
