import { supabase } from './supabase';
import { pickUniqueNames, SURNAMES } from './dwarf-names';
import { createWorldDeriver, FORTRESS_SIZE } from '@pwarf/shared';

const FORTRESS_CENTER = Math.floor(FORTRESS_SIZE / 2);

/** Starting dwarf roles with their skills */
const STARTING_ROLES: { job: string; skills: string[] }[] = [
  { job: 'Miner',      skills: ['mining', 'building'] },
  { job: 'Miner',      skills: ['mining', 'building'] },
  { job: 'Farmer',     skills: ['farming'] },
  { job: 'Farmer',     skills: ['farming'] },
  { job: 'Woodcutter', skills: ['building'] },
  { job: 'Mason',      skills: ['building'] },
  { job: 'Brewer',     skills: ['building'] },
];

/** Offsets from fortress center for starting dwarf positions */
const STARTING_OFFSETS: { dx: number; dy: number }[] = [
  { dx: -1, dy: -1 },
  { dx:  1, dy: -1 },
  { dx: -1, dy:  0 },
  { dx:  1, dy:  0 },
  { dx:  0, dy: -1 },
  { dx:  0, dy:  1 },
  { dx:  0, dy:  0 },
];

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

  // Create 7 starting dwarves with positions near fortress center
  const names = pickUniqueNames(7);
  const dwarves = names.map((name, i) => {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const offset = STARTING_OFFSETS[i];
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
      position_x: FORTRESS_CENTER + offset.dx,
      position_y: FORTRESS_CENTER + offset.dy,
      position_z: 0,
    };
  });

  const { data: insertedDwarves, error: dwarfError } = await supabase
    .from('dwarves')
    .insert(dwarves)
    .select('id');
  if (dwarfError || !insertedDwarves) throw new Error(`Failed to create dwarves: ${dwarfError?.message}`);

  // Create dwarf skills based on roles
  const skills: { dwarf_id: string; skill_name: string; level: number; xp: number }[] = [];
  for (let i = 0; i < insertedDwarves.length; i++) {
    for (const skillName of STARTING_ROLES[i].skills) {
      skills.push({
        dwarf_id: insertedDwarves[i].id,
        skill_name: skillName,
        level: 0,
        xp: 0,
      });
    }
  }
  if (skills.length > 0) {
    const { error: skillError } = await supabase.from('dwarf_skills').insert(skills);
    if (skillError) throw new Error(`Failed to create dwarf skills: ${skillError.message}`);
  }

  // Create starting items
  const startingItems = [
    ...Array.from({ length: 30 }, () => ({
      name: 'Plump helmet spawn',
      category: 'food',
      quality: 'standard',
      material: 'plant',
      weight: 1,
      value: 2,
      is_artifact: false,
      located_in_civ_id: civ.id,
      created_in_civ_id: civ.id,
      created_year: 1,
      properties: {},
    })),
    ...Array.from({ length: 40 }, () => ({
      name: 'Dwarven ale',
      category: 'drink',
      quality: 'standard',
      material: 'plant',
      weight: 1,
      value: 3,
      is_artifact: false,
      located_in_civ_id: civ.id,
      created_in_civ_id: civ.id,
      created_year: 1,
      properties: {},
    })),
    ...Array.from({ length: 10 }, () => ({
      name: 'Plump helmet seed',
      category: 'raw_material',
      quality: 'standard',
      material: 'plant',
      weight: 1,
      value: 1,
      is_artifact: false,
      located_in_civ_id: civ.id,
      created_in_civ_id: civ.id,
      created_year: 1,
      properties: {},
    })),
    ...Array.from({ length: 2 }, () => ({
      name: 'Stone pickaxe',
      category: 'tool',
      quality: 'standard',
      material: 'stone',
      weight: 5,
      value: 10,
      is_artifact: false,
      located_in_civ_id: civ.id,
      created_in_civ_id: civ.id,
      created_year: 1,
      properties: {},
    })),
  ];

  const { error: itemError } = await supabase.from('items').insert(startingItems);
  if (itemError) throw new Error(`Failed to create starting items: ${itemError.message}`);

  // Place a well and mushroom garden near fortress center
  const fortressTiles = [
    {
      civilization_id: civ.id,
      x: FORTRESS_CENTER + 3,
      y: FORTRESS_CENTER,
      z: 0,
      tile_type: 'well',
      material: 'stone',
      is_revealed: true,
      is_mined: false,
    },
    {
      civilization_id: civ.id,
      x: FORTRESS_CENTER - 3,
      y: FORTRESS_CENTER,
      z: 0,
      tile_type: 'mushroom_garden',
      material: 'plant',
      is_revealed: true,
      is_mined: false,
    },
  ];

  const { error: tileOverrideError } = await supabase.from('fortress_tiles').insert(fortressTiles);
  if (tileOverrideError) throw new Error(`Failed to place starting structures: ${tileOverrideError.message}`);

  return civ.id;
}
