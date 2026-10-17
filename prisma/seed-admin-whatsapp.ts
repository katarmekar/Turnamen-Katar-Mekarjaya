import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();
  try {
    const r = await prisma.tournament.updateMany({
      where: { adminWhatsapp: null },
      data: { adminWhatsapp: "082240743344" },
    });
    console.log("Turnamen diisi WA default:", r.count);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
