import { supabase } from './supabase';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@pwarf/shared';

export async function createAndGenerateWorld(
  name: string,
): Promise<{ worldId: string; seed: bigint }> {
  const seed = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));

  const { data: world, error: worldError } = await supabase
    .from('worlds')
    .insert({ name, seed: seed.toString(), width: WORLD_WIDTH, height: WORLD_HEIGHT, age_years: 0 })
    .select('id')
    .single();

  if (worldError || !world) throw new Error(`Failed to create world: ${worldError?.message}`);

  const worldId = world.id;

  // Link world to the current player
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('players').update({ world_id: worldId }).eq('id', user.id);
  }

  return { worldId, seed };
}
