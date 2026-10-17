import { createClient as createJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";

type UploadResult = { path: string } | { error: string };

/**
 * Upload file ke Storage setelah app sudah verifikasi hak akses.
 * Prefer service role (bypass RLS); fallback JWT user eksplisit.
 */
export async function uploadPrivateFile(params: {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}): Promise<UploadResult> {
  const { bucket, path, file, upsert = false } = params;
  const body = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  const service = createServiceClient();
  if (service) {
    const { error } = await service.storage.from(bucket).upload(path, body, {
      upsert,
      contentType,
    });
    if (error) {
      return { error: `Storage (service role): ${error.message}` };
    }
    return { path };
  }

  console.warn(
    "[storage-upload] SUPABASE_SERVICE_ROLE_KEY tidak terbaca — fallback JWT user."
  );

  // Fallback: pakai JWT user secara eksplisit (cookie SSR kadang tidak ikut ke Storage)
  const cookieClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await cookieClient.auth.getUser();
  if (userError || !user) {
    return { error: "Sesi login habis. Silakan login ulang." };
  }

  const {
    data: { session },
  } = await cookieClient.auth.getSession();
  if (!session?.access_token) {
    return {
      error:
        "Sesi Storage tidak valid. Tambahkan SUPABASE_SERVICE_ROLE_KEY di .env atau login ulang.",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authed = createJsClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await authed.storage.from(bucket).upload(path, body, {
    upsert,
    contentType,
  });
  if (error) {
    return {
      error: `${error.message}. Tip: isi SUPABASE_SERVICE_ROLE_KEY di .env (Dashboard → Settings → API).`,
    };
  }
  return { path };
}
