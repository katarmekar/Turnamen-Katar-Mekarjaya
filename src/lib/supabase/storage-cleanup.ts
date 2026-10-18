import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";

const TOURNAMENT_BUCKETS = [
  "payment-proofs",
  "player-docs",
  "team-logos",
] as const;

/** Kumpulkan path file di folder (rekursif). Folder Supabase punya id === null. */
async function listFilesRecursive(
  client: SupabaseClient,
  bucket: string,
  folder: string
): Promise<string[]> {
  try {
    const { data, error } = await client.storage.from(bucket).list(folder, {
      limit: 1000,
    });
    if (error || !data?.length) return [];

    const paths: string[] = [];
    for (const item of data) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      if (item.id === null) {
        paths.push(...(await listFilesRecursive(client, bucket, path)));
      } else {
        paths.push(path);
      }
    }
    return paths;
  } catch (err) {
    console.warn(`[storage-cleanup] list gagal ${bucket}/${folder}`, err);
    return [];
  }
}

async function removePaths(
  client: SupabaseClient,
  bucket: string,
  paths: string[]
): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  const chunkSize = 100;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await client.storage.from(bucket).remove(chunk);
    if (error) {
      console.warn(
        `[storage-cleanup] gagal hapus ${bucket}: ${error.message}`
      );
    }
  }
}

/**
 * Hapus semua file Storage milik tim turnamen (logo, bukti bayar, dokumen/foto pemain).
 * Path mengikuti konvensi `{teamId}/...`.
 * Aman dipanggil sebelum `tournament.delete` (akun user / profiles tidak disentuh).
 */
export async function purgeTournamentStorage(params: {
  teamIds: string[];
  knownPaths?: {
    bucket: (typeof TOURNAMENT_BUCKETS)[number];
    path: string;
  }[];
}): Promise<void> {
  const service = createServiceClient();
  if (!service) {
    console.warn(
      "[storage-cleanup] SUPABASE_SERVICE_ROLE_KEY tidak ada — file Storage mungkin tersisa."
    );
    return;
  }

  const { teamIds, knownPaths = [] } = params;
  if (teamIds.length === 0 && knownPaths.length === 0) return;

  for (const bucket of TOURNAMENT_BUCKETS) {
    const paths: string[] = [];

    for (const teamId of teamIds) {
      paths.push(...(await listFilesRecursive(service, bucket, teamId)));
    }

    for (const known of knownPaths) {
      if (known.bucket === bucket) paths.push(known.path);
    }

    await removePaths(service, bucket, paths);
  }
}
