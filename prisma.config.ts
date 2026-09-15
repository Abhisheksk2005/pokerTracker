import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const dbFile = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "prisma", "dev.db")}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: dbFile,
  },
});
