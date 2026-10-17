import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }
  const prisma = new PrismaClient();
  try {
    const t = await prisma.tournament.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (!t) {
      console.log("Tidak ada turnamen");
      return;
    }
    console.log("before", {
      id: t.id,
      name: t.name,
      adminWhatsapp: t.adminWhatsapp,
    });
    const updated = await prisma.tournament.update({
      where: { id: t.id },
      data: {
        adminWhatsapp: t.adminWhatsapp ?? "082240743344",
      },
    });
    console.log("OK update", {
      id: updated.id,
      adminWhatsapp: updated.adminWhatsapp,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
