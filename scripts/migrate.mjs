// Applies prisma/migrations/*/migration.sql to DATABASE_URL.
//
// `prisma migrate deploy` cannot talk to a hosted Turso (libsql://) database, so
// this small runner does the same job for both Turso and local SQLite files.
// It records applied migrations in `_app_migrations`, and treats anything Prisma
// already applied (`_prisma_migrations`) as done, so existing local databases
// are never re-migrated.
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

if (!url.startsWith("file:") && !authToken) {
  console.error("[migrate] DATABASE_AUTH_TOKEN is required for a remote database.");
  process.exit(1);
}

const db = createClient({ url, authToken });
const target = url.startsWith("file:") ? url : url.replace(/\?.*$/, "");

try {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );

  const applied = new Set((await db.execute("SELECT name FROM _app_migrations")).rows.map((r) => String(r.name)));
  const prismaTable = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'",
  );
  if (prismaTable.rows.length) {
    const done = await db.execute(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
    );
    for (const row of done.rows) applied.add(String(row.migration_name));
  }

  const pending = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .filter((name) => !applied.has(name));

  if (!pending.length) {
    console.log(`[migrate] ${target}: up to date.`);
  }

  for (const name of pending) {
    const sql = readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
    // One atomic batch per migration: its statements plus the bookkeeping row.
    await db.executeMultiple(
      `BEGIN;\n${sql}\n;INSERT INTO _app_migrations (name, applied_at) VALUES ('${name.replace(/'/g, "''")}', '${new Date().toISOString()}');\nCOMMIT;`,
    );
    console.log(`[migrate] applied ${name}`);
  }
} catch (error) {
  try {
    await db.execute("ROLLBACK");
  } catch {
    // no transaction open
  }
  console.error("[migrate] failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  db.close();
}
