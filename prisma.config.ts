import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prefer Next.js env files; dotenv/config alone only loads `.env`.
loadEnv({ path: ".env.local" });
loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
