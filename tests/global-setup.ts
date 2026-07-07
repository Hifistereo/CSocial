import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Runs once per vitest invocation, in its own process: recreate the throwaway
// test database from scratch. Test workers point at the same file via
// tests/setup.ts. (Deleting the file + plain `db push` instead of
// --force-reset keeps this within Prisma's non-destructive CLI surface.)
export default function setup() {
  const dbFile = path.join(process.cwd(), "prisma", "test-run.db");
  fs.rmSync(dbFile, { force: true });
  execSync("npx prisma db push", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: "file:./prisma/test-run.db" },
    stdio: "pipe",
  });
}
