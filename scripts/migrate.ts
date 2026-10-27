/**
 * Applies new files from supabase/migrations to the database in DATABASE_URL.
 *
 *   npm run db:migrate
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing in .env.local");
  process.exit(1);
}

const result = spawnSync("npx", ["supabase", "db", "push", "--db-url", url, "--include-all", "--yes"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
