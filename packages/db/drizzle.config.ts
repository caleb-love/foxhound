import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: process.env["DATABASE_URL"] ?? "postgresql://foxhound:foxhound@localhost:5432/foxhound_dev",
  },
} satisfies Config;
