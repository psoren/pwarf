#!/usr/bin/env node
/**
 * playtest-interactive.mjs
 *
 * Drives the sim in step mode using a plan file (JSON array of commands).
 * Returns all responses as a JSON array. Designed for Claude Code subagents
 * to craft strategies and observe outcomes.
 *
 * Usage:
 *   # With a plan file:
 *   node scripts/playtest-interactive.mjs --scenario idle-fortress --plan plan.json
 *
 *   # With inline commands via stdin:
 *   echo '[{"command":"tick","count":100},{"command":"state"}]' | \
 *     node scripts/playtest-interactive.mjs --scenario starvation
 *
 *   # Quick observe mode (just get state at intervals):
 *   node scripts/playtest-interactive.mjs --scenario starvation --observe 100,200,500
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "sim", "dist", "cli.js");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { scenario: "idle-fortress", seed: 42, plan: null, observe: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scenario" && args[i + 1]) opts.scenario = args[i + 1];
    if (args[i] === "--seed" && args[i + 1]) opts.seed = parseInt(args[i + 1], 10);
    if (args[i] === "--plan" && args[i + 1]) opts.plan = args[i + 1];
    if (args[i] === "--observe" && args[i + 1]) opts.observe = args[i + 1];
  }
  return opts;
}

function startSim(scenario, seed) {
  const proc = spawn(
    "node",
    [cliPath, "--step-mode", "--scenario", scenario, "--seed", String(seed)],
    { stdio: ["pipe", "pipe", "pipe"] }
  );
  const rl = createInterface({ input: proc.stdout, terminal: false });
  const lines = [];
  rl.on("line", line => lines.push(line));
  return { proc, lines };
}

async function waitForLine(lines, timeout = 10000) {
  const start = Date.now();
  while (lines.length === 0) {
    if (Date.now() - start > timeout) throw new Error("Timeout waiting for sim response");
    await new Promise(r => setTimeout(r, 5));
  }
  return JSON.parse(lines.shift());
}

async function send(proc, lines, cmd) {
  proc.stdin.write(JSON.stringify(cmd) + "\n");
  return waitForLine(lines);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => (data += chunk));
    process.stdin.on("end", () => resolve(data.trim()));
    // If stdin is a TTY (no pipe), resolve immediately with empty
    if (process.stdin.isTTY) resolve("");
  });
}

async function main() {
  const opts = parseArgs();

  // Build command list from plan file, stdin, or observe mode
  let commands;
  if (opts.plan) {
    commands = JSON.parse(readFileSync(opts.plan, "utf8"));
  } else if (opts.observe) {
    // --observe 100,200,500 → tick to each checkpoint and snapshot
    const checkpoints = opts.observe.split(",").map(Number);
    commands = [];
    let prevTick = 0;
    for (const cp of checkpoints) {
      const delta = cp - prevTick;
      if (delta > 0) commands.push({ command: "tick", count: delta });
      commands.push({ command: "state" });
      prevTick = cp;
    }
  } else {
    const stdinData = await readStdin();
    if (stdinData) {
      commands = JSON.parse(stdinData);
    } else {
      // Default: observe at intervals
      commands = [
        { command: "state" },
        { command: "tick", count: 100 },
        { command: "tick", count: 200 },
        { command: "tick", count: 200 },
      ];
    }
  }

  const { proc, lines } = startSim(opts.scenario, opts.seed);

  // Wait for ready
  const ready = await waitForLine(lines);

  const responses = [];
  for (const cmd of commands) {
    const resp = await send(proc, lines, cmd);
    responses.push({ command: cmd, response: resp });
  }

  proc.stdin.end();
  proc.kill();

  const report = {
    scenario: opts.scenario,
    seed: opts.seed,
    commands_executed: commands.length,
    timeline: responses,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
