#!/usr/bin/env node
/**
 * step-mode-agent-example.mjs
 *
 * Example: drive the pwarf sim in step mode from an external script.
 * Shows the JSON command protocol without requiring an LLM.
 *
 * Usage:
 *   npm run build --workspace=sim
 *   node scripts/step-mode-agent-example.mjs
 */

import { spawn } from "child_process";
import { createInterface } from "readline";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startSim(scenario = "idle-fortress", seed = 42) {
  const proc = spawn(
    "node",
    ["sim/dist/cli.js", "--step-mode", "--scenario", scenario, "--seed", String(seed)],
    { stdio: ["pipe", "pipe", "inherit"] }
  );

  const rl = createInterface({ input: proc.stdout, terminal: false });
  const lines = [];
  rl.on("line", line => lines.push(line));

  return { proc, lines };
}

async function waitForLine(lines, timeout = 5000) {
  const start = Date.now();
  while (lines.length === 0) {
    if (Date.now() - start > timeout) throw new Error("Timeout waiting for sim response");
    await new Promise(r => setTimeout(r, 10));
  }
  return JSON.parse(lines.shift());
}

async function send(proc, lines, cmd) {
  proc.stdin.write(JSON.stringify(cmd) + "\n");
  return waitForLine(lines);
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

async function main() {
  console.log("Starting sim in step mode...");
  const { proc, lines } = startSim("idle-fortress", 42);

  // Wait for ready signal
  const ready = await waitForLine(lines);
  console.log("Sim ready:", ready);

  // Inspect initial state
  const initialState = await send(proc, lines, { command: "state" });
  console.log(`\n=== Initial state (tick ${initialState.summary.tick}) ===`);
  console.log(`Population: ${initialState.summary.population.alive} alive`);
  for (const d of initialState.dwarves) {
    console.log(`  ${d.name}: food=${d.needs.food}, drink=${d.needs.drink}, activity=${d.activity}`);
  }

  // Designate some mining tasks
  console.log("\n=== Designating 3 mining tasks ===");
  for (let x = 10; x <= 12; x++) {
    const resp = await send(proc, lines, { command: "designate", type: "mine", x, y: 10, z: 0 });
    console.log(`  mine at (${x},10,0) → task_id: ${resp.task_id}`);
  }

  // Advance 50 ticks and observe
  console.log("\n=== Advancing 50 ticks ===");
  const after50 = await send(proc, lines, { command: "tick", count: 50 });
  console.log(`After 50 ticks:`);
  console.log(`  Population: ${after50.summary.population.alive} alive, ${after50.summary.population.dead} dead`);
  console.log(`  Tasks completed: ${after50.summary.tasks_completed}`);
  if (after50.summary.alerts.length > 0) {
    console.log(`  Alerts: ${after50.summary.alerts.join("; ")}`);
  }
  for (const d of after50.dwarves.filter(d => d.status === "alive")) {
    console.log(`  ${d.name}: ${d.activity} | stress=${d.stress}`);
  }

  // Advance another 100 ticks
  console.log("\n=== Advancing 100 more ticks ===");
  const after150 = await send(proc, lines, { command: "tick", count: 100 });
  console.log(`After 150 ticks:`);
  console.log(`  Population: ${after150.summary.population.alive} alive`);
  console.log(`  Tasks completed: ${after150.summary.tasks_completed}`);

  // Recent events
  if (after150.recent_events.length > 0) {
    console.log("\nRecent events:");
    for (const e of after150.recent_events.slice(-5)) {
      console.log(`  [tick ${e.tick}] ${e.text}`);
    }
  }

  // Switch to starvation scenario mid-session
  console.log("\n=== Switching to starvation scenario ===");
  const scenResp = await send(proc, lines, { command: "scenario", name: "starvation" });
  console.log("Scenario loaded:", scenResp);

  const starveState = await send(proc, lines, { command: "state" });
  console.log(`New population: ${starveState.summary.population.alive} dwarves`);

  // Watch dwarves struggle
  console.log("\n=== Running starvation scenario for 300 ticks ===");
  const starveResult = await send(proc, lines, { command: "tick", count: 300 });
  console.log(`Result: ${starveResult.summary.population.alive} alive, ${starveResult.summary.population.dead} dead`);
  if (starveResult.summary.deaths.length > 0) {
    console.log("Deaths:");
    for (const d of starveResult.summary.deaths) {
      console.log(`  ${d.name} (${d.cause})`);
    }
  }

  proc.stdin.end();
  proc.kill();
  console.log("\nDone.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
