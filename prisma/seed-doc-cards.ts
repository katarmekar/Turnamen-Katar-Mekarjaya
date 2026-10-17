import { PrismaClient } from "@prisma/client";
import { DEFAULT_DOC_CARDS } from "../src/lib/doc-cards";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();
  try {
    const tournaments = await prisma.tournament.findMany({ select: { id: true, name: true } });
    for (const t of tournaments) {
      const count = await prisma.tournamentDocCard.count({
        where: { tournamentId: t.id },
      });
      if (count > 0) {
        console.log("Skip", t.name);
        continue;
      }
      await prisma.tournamentDocCard.createMany({
        data: DEFAULT_DOC_CARDS.map((c) => ({
          tournamentId: t.id,
          key: c.key,
          label: c.label,
          required: c.required,
          sortOrder: c.sortOrder,
          active: true,
        })),
      });
      console.log("Seeded", t.name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
