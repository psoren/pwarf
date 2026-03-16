import { supabase } from './supabase';
import { createNoise2D } from 'simplex-noise';
import {
  createAleaRng,
  fbm,
  deriveTerrain,
  deriveBiomeTags,
  deriveSpecialOverlay,
  elevationToMeters,
  SPECIAL_TERRAINS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '@pwarf/shared';

export async function createAndGenerateWorld(
  name: string,
  onProgress?: (pct: number) => void,
): Promise<{ worldId: string; seed: bigint }> {
  // Generate a random seed
  const seed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  // Insert world row
  const { data: world, error: worldError } = await supabase
    .from('worlds')
    .insert({ name, seed: seed.toString(), width: WORLD_WIDTH, height: WORLD_HEIGHT, age_years: 0 })
    .select('id')
    .single();

  if (worldError || !world) throw new Error(`Failed to create world: ${worldError?.message}`);

  const worldId = world.id;

  // Generate tiles using the same algorithm as sim
  const rng = createAleaRng(seed);
  const elevationNoise = createNoise2D(rng);
  const moistureNoise = createNoise2D(rng);
  const temperatureNoise = createNoise2D(rng);
  const specialNoises = SPECIAL_TERRAINS.map(() => createNoise2D(rng));

  const BATCH_SIZE = 1000;
  const tiles: Record<string, unknown>[] = [];
  const totalTiles = WORLD_WIDTH * WORLD_HEIGHT;
  let insertedCount = 0;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let x = 0; x < WORLD_WIDTH; x++) {
      const elevation = fbm(elevationNoise, x, y, 6, 0.005, 1.0);
      const moisture = fbm(moistureNoise, x, y, 4, 0.008, 1.0);
      const temperature = fbm(temperatureNoise, x, y, 3, 0.004, 1.0);

      let terrain = deriveTerrain(elevation, moisture, temperature);
      const special = deriveSpecialOverlay(specialNoises, x, y, 0.003);
      if (special) terrain = special;

      tiles.push({
        world_id: worldId,
        x,
        y,
        coord: `POINT(${x} ${y})`,
        terrain,
        elevation: elevationToMeters(elevation),
        biome_tags: deriveBiomeTags(elevation, moisture, temperature),
        explored: false,
      });
    }

    // Insert in batches as we go
    if (tiles.length >= BATCH_SIZE) {
      const batch = tiles.splice(0, BATCH_SIZE);
      const { error } = await supabase.from('world_tiles').insert(batch);
      if (error) throw new Error(`Failed to insert tiles: ${error.message}`);
      insertedCount += batch.length;
      onProgress?.(Math.round((insertedCount / totalTiles) * 100));
    }
  }

  // Insert remaining tiles
  if (tiles.length > 0) {
    const { error } = await supabase.from('world_tiles').insert(tiles);
    if (error) throw new Error(`Failed to insert remaining tiles: ${error.message}`);
    insertedCount += tiles.length;
    onProgress?.(100);
  }

  // Link world to the current player
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('players').update({ world_id: worldId }).eq('id', user.id);
  }

  return { worldId, seed };
}
