import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * One driver for every environment:
 * - production (Vercel): a hosted Turso database, `DATABASE_URL=libsql://...` + `DATABASE_AUTH_TOKEN`
 * - local dev / Docker: a plain SQLite file, `DATABASE_URL=file:...`
 */
const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const isLocalFile = url.startsWith("file:");

function createClient() {
  const adapter = new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
  const client = new PrismaClient({ adapter });
  if (isLocalFile) {
    // Local files only: WAL keeps readers going during a write, and the busy
    // timeout waits for a competing write instead of failing. Turso manages this itself.
    client
      .$queryRawUnsafe("PRAGMA journal_mode = WAL;")
      .then(() => client.$queryRawUnsafe("PRAGMA busy_timeout = 5000;"))
      .catch((error: unknown) => console.warn("[db] could not tune SQLite pragmas", error));
  }
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
