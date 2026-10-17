import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Next.js long-running server lebih stabil pakai DIRECT_URL (session/direct)
 * daripada transaction pooler :6543. Migrations tetap bisa pakai keduanya di schema.
 */
function createPrismaClient() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
