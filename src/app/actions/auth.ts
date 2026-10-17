"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmUserEmail } from "@/lib/auth-confirm";
import { prisma } from "@/lib/prisma";
import { safeInternalPath } from "@/lib/safe-redirect";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function registerCaptain(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Nama, email, dan password wajib diisi." };
  }

  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "captain",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Lewati konfirmasi email — langsung bisa login
    try {
      await confirmUserEmail(email);
    } catch {
      // Jika gagal (mis. permission), tetap lanjut coba login
    }

    await prisma.profile.upsert({
      where: { id: data.user.id },
      create: {
        id: data.user.id,
        fullName,
        phone: phone || null,
        role: "captain",
      },
      update: {
        fullName,
        phone: phone || null,
      },
    });
  }

  // Jika signup tidak memberi session (karena Confirm email aktif di dashboard),
  // login ulang setelah email di-confirm.
  if (!data.session) {
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      return {
        error:
          "Akun dibuat, tetapi belum bisa masuk otomatis. Coba login manual. Jika gagal, matikan Confirm email di Supabase Auth.",
      };
    }
  }

  redirect("/dashboard");
}

export async function login(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? ""), "/dashboard");

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const supabase = await createClient();
  let { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // Jika email belum confirmed — konfirmasi otomatis lalu coba lagi
  if (error?.message?.toLowerCase().includes("email not confirmed")) {
    try {
      await confirmUserEmail(email);
      const retry = await supabase.auth.signInWithPassword({ email, password });
      signInData = retry.data;
      error = retry.error;
    } catch {
      return {
        error:
          "Email belum dikonfirmasi. Matikan Confirm email di Supabase Dashboard → Authentication → Providers → Email.",
      };
    }
  }

  if (error) {
    return { error: "Email atau password salah." };
  }

  const userId = signInData.user?.id;
  let role: string | null = null;

  if (userId) {
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    role = profile?.role ?? null;
  }

  if (role === "admin" && (next === "/dashboard" || next.startsWith("/dashboard"))) {
    redirect("/admin");
  }

  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
