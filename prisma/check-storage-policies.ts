import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
  const prisma = new PrismaClient();
  try {
    const policies = await prisma.$queryRaw<
      { policyname: string; cmd: string; roles: string[] }[]
    >`
      select policyname, cmd, roles
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname like '%payment_proofs%'
      order by policyname
    `;
    console.log("Policies:", policies);

    const buckets = await prisma.$queryRaw<{ id: string; public: boolean }[]>`
      select id, public from storage.buckets where id = 'payment-proofs'
    `;
    console.log("Bucket:", buckets);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
