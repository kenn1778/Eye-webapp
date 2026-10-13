import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the datasource URL out of schema.prisma and into this config
// file. dotenv/config loads backend/.env so DATABASE_URL is available here and
// to the generated client at runtime. We read process.env directly (instead of
// the env() helper) so `prisma generate`/`validate` still work without a
// database configured - only migrate/db commands actually need the URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
