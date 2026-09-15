#!/usr/bin/env node
/**
 * Backs up the database behind DATABASE_URL.
 *
 * - Local SQLite file (file:...): `VACUUM INTO` writes a consistent .db snapshot,
 *   safe while the app is running, then checks it with integrity_check.
 * - Hosted Turso (libsql://...): downloads a complete .sql dump (schema + rows)
 *   to this computer. Restore with:  turso db shell <database> < backup.sql
 *
 *   npm run db:backup                 -> ./backups/pkrtrackr-<timestamp>.(db|sql)
 *   BACKUP_DIR=/data/backups npm run db:backup
 *   BACKUP_KEEP=30 npm run db:backup  -> prune to the newest 30 (default 14)
 *   BACKUP_FORMAT=sql npm run db:backup -> .sql dump of a local file too
 */
import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;
const isLocal = url.startsWith("file:");
// `BACKUP_FORMAT=sql` forces a portable .sql dump even for a local file.
const asSqlDump = !isLocal || process.env.BACKUP_FORMAT === "sql";
const dir = path.resolve(process.env.BACKUP_DIR ?? "backups");
const keep = Math.max(1, Number(process.env.BACKUP_KEEP ?? 14));
const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);

mkdirSync(dir, { recursive: true });

if (!asSqlDump) {
  const source = path.resolve(url.replace(/^file:/, ""));
  if (!existsSync(source)) {
    console.error(`No database found at ${source}`);
    process.exit(1);
  }
  const target = path.join(dir, `pkrtrackr-${stamp}.db`);
  const db = createClient({ url });
  try {
    await db.execute({ sql: "VACUUM INTO ?", args: [target] });
  } finally {
    db.close();
  }
  const check = createClient({ url: `file:${target}` });
  try {
    const result = await check.execute("PRAGMA integrity_check");
    const status = String(Object.values(result.rows[0] ?? {})[0]);
    if (status !== "ok") throw new Error(`Backup failed integrity check: ${status}`);
  } finally {
    check.close();
  }
  console.log(`Backed up ${source} -> ${target}`);
} else {
  if (!isLocal && !authToken) {
    console.error("DATABASE_AUTH_TOKEN is required to back up a Turso database.");
    process.exit(1);
  }
  const target = path.join(dir, `pkrtrackr-${stamp}.sql`);
  const db = createClient({ url, authToken });
  try {
    const tables = await db.execute(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY name",
    );
    const indexes = await db.execute(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
    );
    const lines = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
    let rowCount = 0;
    for (const table of tables.rows) {
      const name = String(table.name);
      lines.push(`${table.sql};`);
      const rows = await db.execute(`SELECT * FROM "${name.replace(/"/g, '""')}"`);
      for (const row of rows.rows) {
        const values = rows.columns.map((column) => literal(row[column]));
        lines.push(`INSERT INTO "${name.replace(/"/g, '""')}" VALUES (${values.join(",")});`);
        rowCount += 1;
      }
    }
    for (const index of indexes.rows) lines.push(`${index.sql};`);
    lines.push("COMMIT;", "");
    writeFileSync(target, lines.join("\n"), "utf8");
    console.log(`Backed up ${tables.rows.length} tables / ${rowCount} rows from ${isLocal ? "SQLite" : "Turso"} -> ${target}`);
  } finally {
    db.close();
  }
}

const backups = readdirSync(dir)
  .filter((name) => /^pkrtrackr-.*\.(db|sql)$/.test(name))
  .sort()
  .reverse();
for (const stale of backups.slice(keep)) {
  rmSync(path.join(dir, stale), { force: true });
  for (const side of ["-wal", "-shm"]) rmSync(path.join(dir, stale + side), { force: true });
  console.log(`Pruned ${stale}`);
}

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return `X'${Buffer.from(value instanceof ArrayBuffer ? value : value.buffer).toString("hex")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}
