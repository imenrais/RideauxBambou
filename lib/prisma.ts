import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

// Bump when Prisma schema changes so dev HMR does not keep a stale client.
const PRISMA_CLIENT_VERSION = "20260724230000_rate_limit_auth_lockout";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
  prismaPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set.");
}

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString });
  globalForPrisma.prismaPool = pool;
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    const staleClient =
      globalForPrisma.prisma && globalForPrisma.prismaClientVersion !== PRISMA_CLIENT_VERSION;

    if (staleClient) {
      void globalForPrisma.prisma?.$disconnect();
      void globalForPrisma.prismaPool?.end();
      globalForPrisma.prisma = undefined;
      globalForPrisma.prismaPool = undefined;
    }
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
