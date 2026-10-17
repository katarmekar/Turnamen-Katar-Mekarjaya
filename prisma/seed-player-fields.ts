import { PrismaClient } from "@prisma/client";
import { DEFAULT_PLAYER_FIELDS } from "../src/lib/player-fields";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();
  try {
    const tournaments = await prisma.tournament.findMany({
      select: { id: true, name: true },
    });
    for (const t of tournaments) {
      const count = await prisma.tournamentPlayerField.count({
        where: { tournamentId: t.id },
      });
      if (count > 0) {
        console.log("Skip", t.name);
        continue;
      }
      await prisma.tournamentPlayerField.createMany({
        data: DEFAULT_PLAYER_FIELDS.map((f) => ({
          tournamentId: t.id,
          key: f.key,
          label: f.label,
          placeholder: f.placeholder || null,
          fieldType: f.fieldType,
          required: f.required,
          locked: f.locked,
          active: true,
          sortOrder: f.sortOrder,
        })),
      });
      console.log("Seeded fields", t.name);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
