import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Runtime app pakai DATABASE_URL (pooler :6543 + pgbouncer).
 * DIRECT_URL (:5432) sering diblokir firewall/ISP lokal — hanya untuk migrate
 * via schema.prisma `directUrl`.
 */
function runtimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!raw) return undefined;

  try {
    const u = new URL(raw);
    if (!u.searchParams.has("pgbouncer") && u.port === "6543") {
      u.searchParams.set("pgbouncer", "true");
    }
    if (!u.searchParams.has("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    if (!u.searchParams.has("connect_timeout")) {
      u.searchParams.set("connect_timeout", "30");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient() {
  const url = runtimeDatabaseUrl();

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
