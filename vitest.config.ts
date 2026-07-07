import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Sequential files: all tests share one SQLite test database.
    pool: "forks",
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
