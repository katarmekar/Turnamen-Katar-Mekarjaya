/**
 * Import .temp/tokyo-export.json → Supabase Singapore
 * Usage: node --env-file=.env scripts/migrate-region-import.mjs
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

const TABLE_ORDER = [
  "profiles",
  "tournaments",
  "tournament_rules",
  "tournament_doc_cards",
  "tournament_player_fields",
  "teams",
  "payments",
  "players",
  "player_documents",
  "bracket_slots",
  "matches",
];

const USER_SKIP = new Set(["confirmed_at"]);

async function insertRows(client, schema, table, rows, skipCols = new Set()) {
  if (!rows?.length) {
    console.log(`${schema}.${table}: 0`);
    return;
  }
  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => !skipCols.has(c));
    const values = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const sql = `insert into ${schema}.${table} (${cols.join(",")}) values (${placeholders.join(",")}) on conflict do nothing`;
    try {
      await client.query(sql, values);
      ok++;
    } catch (e) {
      fail++;
      if (fail <= 3) {
        console.warn(`  fail ${schema}.${table}:`, e.message.slice(0, 200));
      }
    }
  }
  console.log(`${schema}.${table}: ${ok}/${rows.length}` + (fail ? ` (${fail} fail)` : ""));
}

async function main() {
  const file = path.join(process.cwd(), ".temp", "tokyo-export.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));

  const client = new pg.Client({
    connectionString: SG_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  console.log("Connecting Singapore…");
  await client.connect();

  try {
    await client.query(
      "alter table auth.users disable trigger on_auth_user_created"
    );
    console.log("Disabled on_auth_user_created");
  } catch (e) {
    console.warn("Trigger disable skip:", e.message.slice(0, 120));
  }

  await insertRows(client, "auth", "users", data.auth.users, USER_SKIP);
  await insertRows(client, "auth", "identities", data.auth.identities);

  for (const table of TABLE_ORDER) {
    await insertRows(client, "public", table, data.public[table] || []);
  }

  try {
    await client.query(
      "alter table auth.users enable trigger on_auth_user_created"
    );
  } catch {
    /* ignore */
  }

  await client.end();
  console.log("Import done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
