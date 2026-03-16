import { createNoise2D } from "simplex-noise";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  type WorldTile,
} from "@pwarf/shared";
import {
  createAleaRng,
  fbm,
  deriveTerrain,
  deriveBiomeTags,
  deriveSpecialOverlay,
  elevationToMeters,
  SPECIAL_TERRAINS,
} from "./overworld-helpers.js";

// ============================================================
// Batch insert helper
// ============================================================

const BATCH_SIZE = 1000;

async function batchInsert(
  supabase: SupabaseClient,
  tiles: Omit<WorldTile, "id" | "coord">[]
): Promise<void> {
  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("world_tiles").insert(
      batch.map((t) => ({
        world_id: t.world_id,
        x: t.x,
        y: t.y,
        coord: `POINT(${t.x} ${t.y})`,
        terrain: t.terrain,
        elevation: t.elevation,
        biome_tags: t.biome_tags,
        explored: t.explored,
      }))
    );
    if (error) {
      throw new Error(
        `Failed to insert world_tiles batch starting at index ${i}: ${error.message}`
      );
    }
  }
}

// ============================================================
// Main entry point
// ============================================================

export async function generateOverworld(
  seed: bigint,
  worldId: string,
  supabase: SupabaseClient
): Promise<void> {
  console.log(
    `[world-gen] Generating overworld for world ${worldId} with seed ${seed}`
  );

  const rng = createAleaRng(seed);

  // Create independent noise generators for each layer
  const elevationNoise = createNoise2D(rng);
  const moistureNoise = createNoise2D(rng);
  const temperatureNoise = createNoise2D(rng);

  // Special overlay noises (one per special terrain type)
  const specialNoises = SPECIAL_TERRAINS.map(() => createNoise2D(rng));

  const SPECIAL_FREQUENCY = 0.003;

  const tiles: Omit<WorldTile, "id" | "coord">[] = [];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const elevation = fbm(elevationNoise, x, y, 6, 0.005, 1.0);
      const moisture = fbm(moistureNoise, x, y, 4, 0.008, 1.0);
      const temperature = fbm(temperatureNoise, x, y, 3, 0.004, 1.0);

      let terrain = deriveTerrain(elevation, moisture, temperature);

      // Apply special overlay (rare terrains)
      const special = deriveSpecialOverlay(specialNoises, x, y, SPECIAL_FREQUENCY);
      if (special !== null) {
        terrain = special;
      }

      const biomeTags = deriveBiomeTags(elevation, moisture, temperature);
      const elevationMeters = elevationToMeters(elevation);

      tiles.push({
        world_id: worldId,
        x,
        y,
        terrain,
        elevation: elevationMeters,
        biome_tags: biomeTags,
        explored: false,
      });
    }
  }

  console.log(
    `[world-gen] Generated ${tiles.length} tiles, inserting into database...`
  );

  await batchInsert(supabase, tiles);

  console.log("[world-gen] Overworld generation complete.");
}
