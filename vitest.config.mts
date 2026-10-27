import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.local", quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
