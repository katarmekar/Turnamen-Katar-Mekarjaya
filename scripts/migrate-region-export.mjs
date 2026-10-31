/**
 * Export data dari Supabase sumber → .temp/tokyo-export.json
 * Usage:
 *   $env:SOURCE_DIRECT_URL="postgresql://postgres.REF:PASS@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
 *   node scripts/migrate-region-export.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SOURCE_URL = process.env.SOURCE_DIRECT_URL;
if (!SOURCE_URL) {
  console.error("Set SOURCE_DIRECT_URL (session pooler :5432 project lama)");
  process.exit(1);
}

const PUBLIC_TABLES = [
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

function serializeRows(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString();
      else if (typeof v === "bigint") out[k] = Number(v);
      else out[k] = v;
    }
    return out;
  });
}

async function main() {
  const client = new pg.Client({
    connectionString: SOURCE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  console.log("Connecting source…");
  await client.connect();

  const data = { exportedAt: new Date().toISOString(), auth: {}, public: {} };

  const users = await client.query(`select * from auth.users order by created_at`);
  data.auth.users = serializeRows(users.rows);
  console.log(`auth.users: ${users.rows.length}`);

  try {
    const identities = await client.query(
      `select * from auth.identities order by created_at`
    );
    data.auth.identities = serializeRows(identities.rows);
    console.log(`auth.identities: ${identities.rows.length}`);
  } catch (e) {
    console.warn("auth.identities skip:", e.message);
    data.auth.identities = [];
  }

  for (const table of PUBLIC_TABLES) {
    try {
      const res = await client.query(`select * from public.${table}`);
      data.public[table] = serializeRows(res.rows);
      console.log(`public.${table}: ${res.rows.length}`);
    } catch (e) {
      console.warn(`public.${table} skip:`, e.message);
      data.public[table] = [];
    }
  }

  await client.end();

  const outDir = path.join(process.cwd(), ".temp");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "tokyo-export.json");
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log("Wrote", outFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
