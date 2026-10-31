import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SIGNED_TTL_SEC = 3600;

async function storageClient() {
  const service = createServiceClient();
  return service ?? (await createClient());
}

export async function signPlayerDocPath(
  path: string
): Promise<string | null> {
  const supabase = await storageClient();
  const { data } = await supabase.storage
    .from("player-docs")
    .createSignedUrl(path, SIGNED_TTL_SEC);
  return data?.signedUrl ?? null;
}

/** Batch signed URL — satu round-trip Storage untuk banyak path. */
export async function signPlayerDocPaths(
  paths: string[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const supabase = await storageClient();
  const { data } = await supabase.storage
    .from("player-docs")
    .createSignedUrls(unique, SIGNED_TTL_SEC);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}
