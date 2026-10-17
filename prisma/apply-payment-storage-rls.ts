/**
 * Terapkan policy Storage payment-proofs ke DB.
 * Jalankan: npx tsx --env-file=.env prisma/apply-payment-storage-rls.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

function splitSql(sql: string): string[] {
  return sql
    .split(";")
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter(Boolean);
}

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const prisma = new PrismaClient();
  const sqlPath = join(
    process.cwd(),
    "supabase/migrations/20260317000001_payment_proofs_storage_update.sql"
  );
  const statements = splitSql(readFileSync(sqlPath, "utf8"));

  try {
    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
      console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " ") + "…");
    }
    console.log("---");
    console.log("Policy payment-proofs berhasil diupdate.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
