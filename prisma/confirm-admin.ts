import { PrismaClient } from "@prisma/client";

const EMAIL = "admin@admin.com";

async function main() {
  // Pakai direct connection
  if (process.env.DIRECT_URL) {
    process.env.DATABASE_URL = process.env.DIRECT_URL;
  }

  const prisma = new PrismaClient();

  try {
    await prisma.$executeRaw`
      update auth.users
      set email_confirmed_at = coalesce(email_confirmed_at, now())
      where email = ${EMAIL}
    `;

    const rows = await prisma.$queryRaw<
      {
        id: string;
        email: string;
        email_confirmed_at: Date | null;
        role: string | null;
      }[]
    >`
      select
        u.id::text as id,
        u.email,
        u.email_confirmed_at,
        p.role::text as role
      from auth.users u
      left join public.profiles p on p.id = u.id
      where u.email = ${EMAIL}
      limit 1
    `;

    console.log(rows[0] ?? "User tidak ditemukan");
    console.log("---");
    console.log("Login: admin@admin.com / admin1");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
