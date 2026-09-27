import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dataDirectory = process.env.PRODUCTION_CONTROL_DATA_DIR
  ? path.resolve(process.env.PRODUCTION_CONTROL_DATA_DIR)
  : path.join(process.cwd(), ".local-production-control");
mkdirSync(dataDirectory, { recursive: true });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: path.join(dataDirectory, "production-control.sqlite") },
});
