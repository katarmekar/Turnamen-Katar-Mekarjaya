/**
 * Buat akun admin.
 * Jalankan: npx tsx --env-file=.env prisma/seed-admin.ts
 *
 * Login: admin@admin.com / admin1
 * (Supabase Auth pakai email; password min. 6 karakter — "admin" terlalu pendek)
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient, UserRole } from "@prisma/client";

const EMAIL = "admin@admin.com";
/** Min 6 karakter (aturan Supabase) — "admin" saja ditolak */
const PASSWORD = "admin1";
const FULL_NAME = "Admin";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum diisi di .env");
  }

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const prisma = new PrismaClient();

  try {
    let userId: string | undefined;

    const { data, error } = await supabase.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
      options: {
        data: {
          full_name: FULL_NAME,
          role: "admin",
        },
      },
    });

    if (error) {
      // Mungkin sudah terdaftar — coba login
      const login = await supabase.auth.signInWithPassword({
        email: EMAIL,
        password: PASSWORD,
      });

      if (login.error) {
        throw new Error(
          `Gagal buat/login admin: ${error.message} | login: ${login.error.message}`
        );
      }

      userId = login.data.user?.id;
      console.log("Akun sudah ada, login berhasil.");
    } else {
      userId = data.user?.id;
      console.log("Akun admin dibuat via Auth.");
      if (!data.session) {
        console.log(
          "Catatan: email confirmation mungkin aktif — akun tetap dibuat."
        );
      }
    }

    if (!userId) {
      throw new Error("User id tidak ditemukan setelah signup/login.");
    }

    await prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        fullName: FULL_NAME,
        role: UserRole.admin,
      },
      update: {
        fullName: FULL_NAME,
        role: UserRole.admin,
      },
    });

    console.log("Profile role = admin");
    console.log("---");
    console.log(`Email    : ${EMAIL}`);
    console.log(`Password : ${PASSWORD}`);
    console.log("Buka /login lalu masuk dengan kredensial di atas.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
