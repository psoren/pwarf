#!/usr/bin/env node
/**
 * Reset local Supabase DB (apply all migrations) and start the dev app.
 *
 * Usage:  node scripts/reset-and-start.mjs
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

// 1. Ensure .env.local exists (copy from main checkout if in a worktree)
const envPath = resolve(ROOT, "app/.env.local");
if (!existsSync(envPath)) {
  // Try copying from the main checkout
  const mainEnv = resolve(ROOT, "../../app/.env.local");
  if (existsSync(mainEnv)) {
    copyFileSync(mainEnv, envPath);
    console.log("Copied app/.env.local from main checkout");
  } else {
    console.error("Missing app/.env.local — create it with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
    process.exit(1);
  }
}

// 2. Make sure Supabase is running
try {
  execSync("supabase status", { cwd: ROOT, stdio: "pipe" });
  console.log("Supabase is running");
} catch {
  console.log("Starting Supabase...");
  run("supabase start");
}

// 3. Reset DB (drops everything, re-applies all migrations + seed)
console.log("\nResetting database (applying all migrations)...");
run("supabase db reset");

// 4. Install deps (in case node_modules is stale)
run("npm install");

// 5. Build shared (sim and app depend on it)
run("npm run build --workspace=shared");

// 6. Start dev server
console.log("\nStarting dev app...");
const child = spawn("npm", ["run", "dev:app"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 0));

// Forward signals so Ctrl+C kills Vite cleanly
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
