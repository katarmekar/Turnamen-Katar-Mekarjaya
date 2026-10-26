import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getSessionUser();
  if (!user) return null;

  try {
    return await prisma.profile.findUnique({
      where: { id: user.id },
    });
  } catch (err) {
    console.error("[getCurrentProfile] database error", err);
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireProfile() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireRole(role: UserRole) {
  const profile = await requireProfile();
  if (profile.role !== role) {
    redirect(profile.role === "admin" ? "/admin" : "/dashboard");
  }
  return profile;
}
