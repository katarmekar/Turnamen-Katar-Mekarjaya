import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  console.log(
    "using:",
    url?.replace(/:[^:@]+@/, ":***@").slice(0, 120)
  );
  const prisma = new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
  });
  const n = await prisma.profile.count();
  console.log("profile_count:", n);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
