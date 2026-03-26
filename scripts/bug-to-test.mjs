#!/usr/bin/env node

/**
 * Generate a scenario test skeleton from a bug report stored in Supabase.
 *
 * Usage:
 *   node scripts/bug-to-test.mjs <bug-report-id>
 *   node scripts/bug-to-test.mjs --list          # list recent bug reports
 *
 * The script reads the bug report's game_state JSONB and generates a
 * runScenario() test file that reconstructs the exact world state.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load env from app/.env.local
function loadEnv() {
  const envPath = resolve(ROOT, "app", ".env.local");
  if (!existsSync(envPath)) {
    console.error("Missing app/.env.local — needed for Supabase credentials");
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in app/.env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listReports() {
  const { data, error } = await supabase
    .from("bug_reports")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to fetch bug reports:", error.message);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log("No bug reports found.");
    return;
  }

  console.log("Recent bug reports:\n");
  for (const r of data) {
    const date = new Date(r.created_at).toLocaleDateString();
    console.log(`  ${r.id}  ${date}  ${r.title}`);
  }
  console.log(`\nRun: node scripts/bug-to-test.mjs <id>`);
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function generateTest(report) {
  const { title, description, game_state: state } = report;
  const slug = slugify(title);
  const hasDwarves = state.dwarves?.length > 0;
  const hasTasks = state.tasks?.length > 0;
  const hasItems = state.items?.length > 0;
  const hasStructures = state.structures?.length > 0;
  const hasTiles = state.fortressTileOverrides?.length > 0;
  const hasStockpiles = state.stockpileTiles?.length > 0;
  const hasMonsters = state.monsters?.length > 0;
  const hasSkills = state.dwarfSkills?.length > 0;

  const lines = [];
  lines.push(`import { describe, it, expect } from "vitest";`);
  lines.push(`import { runScenario } from "../run-scenario.js";`);
  lines.push(`import type { ScenarioConfig } from "../run-scenario.js";`);

  // Import types we need
  const types = ["Dwarf"];
  if (hasTasks) types.push("Task");
  if (hasItems) types.push("Item");
  if (hasStructures) types.push("Structure");
  if (hasTiles) types.push("FortressTile");
  if (hasStockpiles) types.push("StockpileTile");
  if (hasMonsters) types.push("Monster");
  if (hasSkills) types.push("DwarfSkill");
  lines.push(`import type { ${types.join(", ")} } from "@pwarf/shared";`);
  lines.push(``);

  // Emit state as JSON constants
  lines.push(`// State captured from bug report: ${title}`);
  lines.push(`// ${description.replace(/\n/g, "\n// ")}`);
  lines.push(``);

  if (hasDwarves) {
    lines.push(`const dwarves: Dwarf[] = ${JSON.stringify(state.dwarves, null, 2)} as Dwarf[];`);
    lines.push(``);
  }
  if (hasSkills) {
    lines.push(`const dwarfSkills: DwarfSkill[] = ${JSON.stringify(state.dwarfSkills, null, 2)} as DwarfSkill[];`);
    lines.push(``);
  }
  if (hasTasks) {
    // Only include non-completed tasks for the scenario
    const activeTasks = state.tasks.filter(t => t.status !== "completed");
    lines.push(`const tasks: Task[] = ${JSON.stringify(activeTasks, null, 2)} as Task[];`);
    lines.push(``);
  }
  if (hasItems) {
    lines.push(`const items: Item[] = ${JSON.stringify(state.items, null, 2)} as Item[];`);
    lines.push(``);
  }
  if (hasStructures) {
    lines.push(`const structures: Structure[] = ${JSON.stringify(state.structures, null, 2)} as Structure[];`);
    lines.push(``);
  }
  if (hasTiles) {
    lines.push(`const fortressTileOverrides: FortressTile[] = ${JSON.stringify(state.fortressTileOverrides, null, 2)} as FortressTile[];`);
    lines.push(``);
  }
  if (hasStockpiles) {
    lines.push(`const stockpileTiles: StockpileTile[] = ${JSON.stringify(state.stockpileTiles, null, 2)} as StockpileTile[];`);
    lines.push(``);
  }
  if (hasMonsters) {
    lines.push(`const monsters: Monster[] = ${JSON.stringify(state.monsters, null, 2)} as Monster[];`);
    lines.push(``);
  }

  // Build the test
  lines.push(`describe("bug report: ${title.replace(/"/g, '\\"')}", () => {`);
  lines.push(`  it("should reproduce and verify the fix", async () => {`);
  lines.push(`    const config: ScenarioConfig = {`);
  if (hasDwarves) lines.push(`      dwarves,`);
  if (hasSkills) lines.push(`      dwarfSkills,`);
  if (hasTasks) lines.push(`      tasks,`);
  if (hasItems) lines.push(`      items,`);
  if (hasStructures) lines.push(`      structures,`);
  if (hasTiles) lines.push(`      fortressTileOverrides,`);
  if (hasStockpiles) lines.push(`      stockpileTiles,`);
  if (hasMonsters) lines.push(`      monsters,`);
  lines.push(`      ticks: 200,`);
  lines.push(`      seed: 42,`);
  lines.push(`    };`);
  lines.push(``);
  lines.push(`    const result = await runScenario(config);`);
  lines.push(``);
  lines.push(`    // TODO: Add assertions for the expected behavior.`);
  lines.push(`    // Examples:`);
  lines.push(`    // - Verify no dwarf is stuck idle with pending tasks`);
  lines.push(`    // - Verify a specific task completed`);
  lines.push(`    // - Verify no dwarf died unexpectedly`);
  lines.push(`    const aliveDwarves = result.dwarves.filter(d => d.status === "alive");`);
  lines.push(`    expect(aliveDwarves.length).toBeGreaterThan(0);`);
  lines.push(``);
  lines.push(`    // Stuck detection: no alive dwarf should be idle if there are pending tasks`);
  lines.push(`    const pendingTasks = result.tasks.filter(t => t.status === "pending");`);
  lines.push(`    const idleDwarves = aliveDwarves.filter(d => d.current_task_id === null);`);
  lines.push(`    if (pendingTasks.length > 0) {`);
  lines.push(`      expect(idleDwarves.length, "dwarves idle with pending tasks").toBeLessThan(aliveDwarves.length);`);
  lines.push(`    }`);
  lines.push(`  });`);
  lines.push(`});`);
  lines.push(``);

  return { slug, content: lines.join("\n") };
}

async function generateFromReport(reportId) {
  const { data, error } = await supabase
    .from("bug_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (error || !data) {
    console.error("Failed to fetch bug report:", error?.message ?? "not found");
    process.exit(1);
  }

  if (!data.game_state || Object.keys(data.game_state).length === 0) {
    console.error("Bug report has no game state snapshot.");
    process.exit(1);
  }

  const { slug, content } = generateTest(data);
  const filename = `bug-${slug}.test.ts`;
  const outPath = resolve(ROOT, "sim", "src", "__tests__", filename);

  writeFileSync(outPath, content, "utf-8");
  console.log(`Generated: sim/src/__tests__/${filename}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add specific assertions for the bug`);
  console.log(`  2. Run: npm test --workspace=sim -- --run ${filename}`);
  console.log(`  3. Verify it fails (red), then fix the bug, then verify it passes (green)`);
}

// Main
const arg = process.argv[2];
if (!arg) {
  console.log("Usage:");
  console.log("  node scripts/bug-to-test.mjs <bug-report-id>");
  console.log("  node scripts/bug-to-test.mjs --list");
  process.exit(0);
}

if (arg === "--list") {
  await listReports();
} else {
  await generateFromReport(arg);
}
