import { prisma } from "@/lib/prisma";

/**
 * Tandai email sudah confirmed di auth.users
 * (agar login langsung tanpa cek inbox).
 */
export async function confirmUserEmail(email: string) {
  await prisma.$executeRaw`
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where email = ${email}
  `;
}
