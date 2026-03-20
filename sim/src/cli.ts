import { createClient } from "@supabase/supabase-js";
import { SimRunner } from "./sim-runner.js";
import { SupabaseStateAdapter } from "./state-adapter.js";
import { runHeadless } from "./headless-runner.js";
import { runStepMode } from "./step-mode.js";
import { SCENARIOS } from "./scenarios.js";

// Parse CLI args
const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const scenarioArg = getArg("--scenario");
const ticksArg = getArg("--ticks");
const outputArg = getArg("--output");
const snapshotEveryArg = getArg("--snapshot-every");
const seedArg = getArg("--seed");

// --- Step mode (interactive JSON protocol on stdin/stdout) ---
if (hasFlag("--step-mode")) {
  const seed = seedArg ? parseInt(seedArg, 10) : 0;
  runStepMode({ seed, scenario: scenarioArg })
    .then(() => process.exit(0))
    .catch(err => {
      console.error("[sim] step mode failed:", err);
      process.exit(1);
    });

// --- Headless / batch mode ---
} else if (scenarioArg || hasFlag("--headless")) {
  const ticks = ticksArg ? parseInt(ticksArg, 10) : undefined;
  const snapshotEvery = snapshotEveryArg ? parseInt(snapshotEveryArg, 10) : 0;

  if (scenarioArg && !SCENARIOS[scenarioArg]) {
    console.error(`[sim] Unknown scenario "${scenarioArg}". Available: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  runHeadless({ scenario: scenarioArg, ticks, snapshotEvery })
    .then(result => {
      if (outputArg === "json") {
        if (snapshotEvery > 0 && result.snapshots.length > 0) {
          process.stdout.write(JSON.stringify({ snapshots: result.snapshots, final: result.finalSnapshot }, null, 2));
        } else {
          process.stdout.write(JSON.stringify(result.finalSnapshot, null, 2));
        }
        process.stdout.write("\n");
      } else {
        const { summary } = result.finalSnapshot;
        console.log(`[sim] run complete — ${result.ticks} ticks`);
        console.log(`[sim] population: ${summary.population.alive} alive, ${summary.population.dead} dead`);
        if (summary.alerts.length > 0) {
          console.log(`[sim] alerts: ${summary.alerts.join("; ")}`);
        }
        if (summary.deaths.length > 0) {
          for (const d of summary.deaths) {
            console.log(`[sim] death: ${d.name} (${d.cause}, year ${d.year})`);
          }
        }
      }
      process.exit(0);
    })
    .catch(err => {
      console.error("[sim] headless run failed:", err);
      process.exit(1);
    });

} else {
  // --- Live mode (requires Supabase) ---
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "[sim] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
    );
    console.error("[sim] For headless/batch mode, use --scenario <name> or --headless");
    console.error("[sim] For interactive step mode, use --step-mode [--seed N] [--scenario name]");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const runner = new SimRunner(new SupabaseStateAdapter(supabase));

  const civId = process.env.CIVILIZATION_ID ?? "default";
  const worldId = process.env.WORLD_ID;

  runner.start(civId, worldId).catch((err) => {
    console.error("[sim] failed to start:", err);
    process.exit(1);
  });

  process.on("SIGINT", async () => {
    await runner.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await runner.stop();
    process.exit(0);
  });
}
