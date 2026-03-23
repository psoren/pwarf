#!/usr/bin/env node
/**
 * playtest-all.mjs
 *
 * Runs all predefined scenarios in batch mode and outputs a combined JSON report.
 * Designed to be consumed by a Claude Code subagent for analysis.
 *
 * Usage:
 *   node scripts/playtest-all.mjs                    # all scenarios, default ticks
 *   node scripts/playtest-all.mjs --ticks 1000       # override tick count
 *   node scripts/playtest-all.mjs --scenario starvation  # single scenario
 *   node scripts/playtest-all.mjs --pretty            # pretty-print output
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = join(__dirname, "..", "sim", "dist", "cli.js");

const SCENARIOS = ["starvation", "idle-fortress", "long-run-stability", "overcrowding"];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { ticks: null, scenario: null, pretty: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ticks" && args[i + 1]) opts.ticks = parseInt(args[i + 1], 10);
    if (args[i] === "--scenario" && args[i + 1]) opts.scenario = args[i + 1];
    if (args[i] === "--pretty") opts.pretty = true;
  }
  return opts;
}

function runScenario(scenario, ticks) {
  return new Promise((resolve, reject) => {
    const args = ["--scenario", scenario, "--output", "json"];
    if (ticks) args.push("--ticks", String(ticks));

    const proc = spawn("node", [cliPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => (stdout += d));
    proc.stderr.on("data", d => (stderr += d));
    proc.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Scenario "${scenario}" failed (code ${code}): ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Scenario "${scenario}" returned invalid JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

async function main() {
  const opts = parseArgs();
  const scenarios = opts.scenario ? [opts.scenario] : SCENARIOS;

  const results = {};
  for (const name of scenarios) {
    try {
      results[name] = await runScenario(name, opts.ticks);
    } catch (err) {
      results[name] = { error: err.message };
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    scenarios_run: scenarios,
    results,
  };

  if (opts.pretty) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(JSON.stringify(report) + "\n");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
