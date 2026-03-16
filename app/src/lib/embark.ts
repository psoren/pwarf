import { supabase } from './supabase';
import { pickUniqueNames, SURNAMES } from './dwarf-names';

export async function embark(worldId: string, tileX: number, tileY: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Create civilization
  const { data: civ, error: civError } = await supabase
    .from('civilizations')
    .insert({
      world_id: worldId,
      player_id: user.id,
      name: 'Boatmurdered',
      tile_x: tileX,
      tile_y: tileY,
      status: 'active',
      founded_year: 1,
      population: 7,
      wealth: 0,
    })
    .select('id')
    .single();

  if (civError || !civ) throw new Error(`Failed to create civilization: ${civError?.message}`);

  // Create 7 starting dwarves
  const names = pickUniqueNames(7);
  const dwarves = names.map((name) => {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    return {
      civilization_id: civ.id,
      name,
      surname,
      status: 'alive',
      age: 20 + Math.floor(Math.random() * 30),
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 100,
      need_purpose: 100,
      need_beauty: 100,
      stress_level: 0,
      is_in_tantrum: false,
      health: 100,
    };
  });

  const { error: dwarfError } = await supabase.from('dwarves').insert(dwarves);
  if (dwarfError) throw new Error(`Failed to create dwarves: ${dwarfError.message}`);

  // Mark embark tile and neighbors as explored
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      await supabase
        .from('world_tiles')
        .update({ explored: true })
        .eq('world_id', worldId)
        .eq('x', tileX + dx)
        .eq('y', tileY + dy);
    }
  }

  return civ.id;
}
