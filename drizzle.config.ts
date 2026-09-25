import { defineConfig } from "drizzle-kit";

const connectionString = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("EXTERNAL_DATABASE_URL or DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
