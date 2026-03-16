import { supabase } from './supabase';
import { pickUniqueNames, SURNAMES } from './dwarf-names';
import { createWorldDeriver } from '@pwarf/shared';

export async function embark(worldId: string, tileX: number, tileY: number, worldSeed: bigint) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Derive and upsert embark tile + neighbors into world_tiles.
  // With lazy world gen, tiles aren't stored until needed. The civilizations
  // table has a FK on (world_id, tile_x, tile_y) -> world_tiles, so the
  // embark tile must exist before we can create the civilization.
  const deriver = createWorldDeriver(worldSeed);
  const tilesToUpsert = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = tileX + dx;
      const y = tileY + dy;
      const derived = deriver.deriveTile(x, y);
      tilesToUpsert.push({
        world_id: worldId,
        x,
        y,
        coord: `SRID=4326;POINT(${x} ${y})`,
        terrain: derived.terrain,
        elevation: derived.elevation,
        biome_tags: derived.biome_tags,
        explored: true,
      });
    }
  }

  const { error: tileError } = await supabase
    .from('world_tiles')
    .upsert(tilesToUpsert, { onConflict: 'world_id,x,y' });

  if (tileError) throw new Error(`Failed to upsert embark tiles: ${tileError.message}`);

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

  return civ.id;
}
