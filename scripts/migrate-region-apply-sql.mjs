/**
 * Jalankan supabase/migrations/*.sql berurutan ke Singapore.
 * Usage: node --env-file=.env scripts/migrate-region-apply-sql.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SG_URL =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL?.replace(":6543", ":5432").replace(
    "?pgbouncer=true",
    ""
  );

async function main() {
  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({
    connectionString: SG_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  console.log("Connecting Singapore…");
  await client.connect();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`\n=== ${file} ===`);
    try {
      await client.query(sql);
      console.log("OK");
    } catch (e) {
      console.warn("WARN:", e.message.slice(0, 300));
    }
  }

  await client.end();
  console.log("\nSQL apply finished.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
