import { createClient } from "@supabase/supabase-js";
import { SimRunner } from "./sim-runner.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "[sim] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const runner = new SimRunner(supabase);

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
