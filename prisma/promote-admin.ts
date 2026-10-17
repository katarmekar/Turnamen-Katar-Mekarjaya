import { createClient } from "@supabase/supabase-js";
import { PrismaClient, UserRole } from "@prisma/client";

const EMAIL = "admin@admin.com";
const PASSWORD = "admin1";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const login = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  console.log("login_error:", login.error?.message ?? null);
  console.log("user_id:", login.data.user?.id ?? null);
  console.log("has_session:", Boolean(login.data.session));

  const userId = login.data.user?.id;
  if (!userId) {
    // Coba lewat Prisma dengan DIRECT_URL jika login gagal (email confirm)
    process.env.DATABASE_URL = process.env.DIRECT_URL;
    const prisma = new PrismaClient();
    try {
      const rows = await prisma.$queryRaw<
        { id: string; email: string }[]
      >`select id::text as id, email from auth.users where email = ${EMAIL} limit 1`;
      console.log("auth.users via prisma:", rows);
      if (rows[0]) {
        await prisma.profile.upsert({
          where: { id: rows[0].id },
          create: {
            id: rows[0].id,
            fullName: "Admin",
            role: UserRole.admin,
          },
          update: { role: UserRole.admin, fullName: "Admin" },
        });
        console.log("Promoted via Prisma DIRECT_URL");
      }
    } catch (e) {
      console.error("Prisma fallback failed:", e);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  console.log("profile:", profile, error?.message ?? null);

  if (!profile) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
      full_name: "Admin",
      role: "admin",
    });
    console.log("insert_profile_error:", insertError?.message ?? null);
  } else if (profile.role !== "admin") {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: "admin", full_name: "Admin" })
      .eq("id", userId);
    console.log("update_profile_error:", updateError?.message ?? null);
  } else {
    console.log("Sudah admin.");
  }

  // Pastikan lewat Prisma juga
  try {
    process.env.DATABASE_URL = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    const prisma = new PrismaClient();
    await prisma.profile.upsert({
      where: { id: userId },
      create: { id: userId, fullName: "Admin", role: UserRole.admin },
      update: { role: UserRole.admin, fullName: "Admin" },
    });
    console.log("Prisma role sync OK");
    await prisma.$disconnect();
  } catch (e) {
    console.error("Prisma sync skipped:", (e as Error).message);
  }

  console.log("---");
  console.log(`Login: ${EMAIL} / ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
