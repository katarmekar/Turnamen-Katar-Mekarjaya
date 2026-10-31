/**
 * Copy Storage buckets sumber → target (service role).
 * Usage (dengan --env-file=.env untuk target):
 *   $env:SOURCE_SUPABASE_URL="https://OLD.supabase.co"
 *   $env:SOURCE_SERVICE_ROLE_KEY="..."
 *   node --env-file=.env scripts/migrate-region-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";

const TOKYO = {
  url: process.env.SOURCE_SUPABASE_URL,
  key: process.env.SOURCE_SERVICE_ROLE_KEY,
};

const SG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

const BUCKETS = ["player-docs", "payment-proofs", "team-logos"];

async function listAll(client, bucket, prefix = "") {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.metadata?.mimetype && item.id === null) {
        const nested = await listAll(client, bucket, path);
        out.push(...nested);
        continue;
      }
      if (item.metadata?.mimetype || item.id) {
        out.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  if (!TOKYO.url || !TOKYO.key) {
    throw new Error("Set SOURCE_SUPABASE_URL + SOURCE_SERVICE_ROLE_KEY");
  }
  if (!SG.url || !SG.key) {
    throw new Error("Missing target env (NEXT_PUBLIC_SUPABASE_URL / SERVICE_ROLE)");
  }
  const src = createClient(TOKYO.url, TOKYO.key);
  const dst = createClient(SG.url, SG.key);

  for (const bucket of BUCKETS) {
    console.log(`\nBucket ${bucket}`);
    let paths = [];
    try {
      paths = await listAll(src, bucket);
    } catch (e) {
      console.warn(" list fail:", e.message);
      continue;
    }
    console.log(` files: ${paths.length}`);
    let ok = 0;
    let fail = 0;
    for (const path of paths) {
      const { data: blob, error: dlErr } = await src.storage
        .from(bucket)
        .download(path);
      if (dlErr || !blob) {
        fail++;
        if (fail <= 5) console.warn("  dl", path, dlErr?.message);
        continue;
      }
      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: upErr } = await dst.storage
        .from(bucket)
        .upload(path, buf, { upsert: true, contentType: blob.type || undefined });
      if (upErr) {
        fail++;
        if (fail <= 5) console.warn("  up", path, upErr.message);
      } else {
        ok++;
      }
      if ((ok + fail) % 25 === 0) {
        console.log(`  progress ${ok + fail}/${paths.length}`);
      }
    }
    console.log(` done ok=${ok} fail=${fail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
