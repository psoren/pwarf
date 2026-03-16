import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  type TerrainType,
  type WorldTile,
} from "@pwarf/shared";

// ============================================================
// Seeded PRNG (Alea algorithm by Johannes Baagøe)
// ============================================================

function createAleaRng(seed: bigint): () => number {
  // Mix seed into three state variables using a simple hash
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;

  const seedStr = seed.toString();

  // Mash function to initialize state from string
  function mash(data: string): number {
    let n = 0xefc8249d;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  }

  s0 = mash(" ");
  s1 = mash(" ");
  s2 = mash(" ");

  s0 -= mash(seedStr);
  if (s0 < 0) s0 += 1;
  s1 -= mash(seedStr);
  if (s1 < 0) s1 += 1;
  s2 -= mash(seedStr);
  if (s2 < 0) s2 += 1;

  return function () {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10;
    s0 = s1;
    s1 = s2;
    c = t | 0;
    s2 = t - c;
    return s2;
  };
}

// ============================================================
// Fractal Brownian Motion
// ============================================================

function fbm(
  noise2D: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  frequency: number,
  amplitude: number
): number {
  let value = 0;
  let freq = frequency;
  let amp = amplitude;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= 2;
    amp *= 0.5;
  }

  // Normalize to [0, 1] — noise2D returns [-1, 1]
  return (value / maxAmp + 1) / 2;
}

// ============================================================
// Terrain derivation
// ============================================================

function deriveTerrain(
  elevation: number,
  moisture: number,
  temperature: number
): TerrainType {
  // Priority-ordered rules from design spec
  if (elevation < 0.25) return "ocean";
  if (elevation > 0.85 && temperature < 0.3) return "tundra";
  if (elevation > 0.85) return "mountain";
  if (elevation > 0.75 && moisture < 0.2 && temperature > 0.7) return "volcano";
  if (temperature < 0.15) return "tundra";
  if (moisture > 0.7 && temperature > 0.6) return "swamp";
  if (moisture < 0.2 && temperature > 0.6) return "desert";
  if (moisture > 0.5 && temperature > 0.3) return "forest";
  if (elevation > 0.6) return "mountain";
  return "plains";
}

// ============================================================
// Biome tags derivation
// ============================================================

function deriveBiomeTags(
  elevation: number,
  moisture: number,
  temperature: number
): string[] {
  const tags: string[] = [];

  // Temperature tags
  if (temperature < 0.2) tags.push("freezing");
  else if (temperature < 0.4) tags.push("cold");
  else if (temperature < 0.6) tags.push("temperate");
  else if (temperature < 0.8) tags.push("warm");
  else tags.push("hot");

  // Moisture tags
  if (moisture < 0.2) tags.push("arid");
  else if (moisture < 0.4) tags.push("dry");
  else if (moisture < 0.6) tags.push("moderate");
  else if (moisture < 0.8) tags.push("humid");
  else tags.push("drenched");

  // Elevation tags
  if (elevation < 0.25) tags.push("submerged");
  else if (elevation < 0.4) tags.push("lowland");
  else if (elevation < 0.6) tags.push("midland");
  else if (elevation < 0.8) tags.push("highland");
  else tags.push("alpine");

  return tags;
}

// ============================================================
// Special terrain overlay
// ============================================================

type SpecialTerrain = "underground" | "haunted" | "savage" | "evil";

const SPECIAL_TERRAINS: SpecialTerrain[] = [
  "underground",
  "haunted",
  "savage",
  "evil",
];

function deriveSpecialOverlay(
  specialNoises: NoiseFunction2D[],
  x: number,
  y: number,
  frequency: number
): TerrainType | null {
  for (let i = 0; i < specialNoises.length; i++) {
    const value = (specialNoises[i](x * frequency, y * frequency) + 1) / 2;
    if (value > 0.95) {
      return SPECIAL_TERRAINS[i];
    }
  }
  return null;
}

// ============================================================
// Elevation to meters conversion
// ============================================================

function elevationToMeters(normalizedElevation: number): number {
  // Map [0, 1] to [-200, 2000] meters
  // Ocean (< 0.25) maps to roughly [-200, 300]
  // Mountains (> 0.85) maps to roughly [1700, 2000]
  return Math.round(normalizedElevation * 2200 - 200);
}

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
