/**
 * Terapkan peraturan dari PDF Katar Mekarjaya Cup 2026 ke semua turnamen.
 * Jalankan: npx tsx --env-file=.env prisma/seed-rules-from-pdf.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_TOURNAMENT_RULES,
  replaceTournamentRulesFromDefault,
} from "../src/lib/tournament-rules";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();
  try {
    const tournaments = await prisma.tournament.findMany({
      select: { id: true, name: true },
    });
    console.log(
      `Turnamen: ${tournaments.length} · Pasal PDF: ${DEFAULT_TOURNAMENT_RULES.length}`
    );
    for (const t of tournaments) {
      await replaceTournamentRulesFromDefault(t.id);
      console.log("OK:", t.name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
