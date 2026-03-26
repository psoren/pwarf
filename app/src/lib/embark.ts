import { supabase } from './supabase';
import { pickUniqueNames, SURNAMES } from './dwarf-names';
import {
  createWorldDeriver,
  createFortressDeriver,
  generateCaveName,
  getCaveSeed,
  FORTRESS_SIZE,
} from '@pwarf/shared';
import type { TerrainType } from '@pwarf/shared';
import { generateFortressName } from './civ-names';

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
      name: generateFortressName(),
      tile_x: tileX,
      tile_y: tileY,
      status: 'active',
      founded_year: 1,
      population: 7,
      wealth: 0,
    })
    .select('id, name')
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
      gender: Math.random() < 0.5 ? 'male' : 'female',
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 100,
      need_purpose: 0,
      need_beauty: 0,
      stress_level: 0,
      is_in_tantrum: false,
      health: 100,
      position_x: FORTRESS_CENTER + offset.dx,
      position_y: FORTRESS_CENTER + offset.dy,
      position_z: 0,
      // Personality traits: 0.0–1.0 (Big Five, where 0.5 = average)
      trait_openness: Math.random(),
      trait_conscientiousness: Math.random(),
      trait_extraversion: Math.random(),
      trait_agreeableness: Math.random(),
      trait_neuroticism: Math.random(),
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

  // Create starting food items — enough to survive while foraging ramps up.
  // Dwarves drink from the starting well, so no drink items needed.
  const startingItems = Array.from({ length: 15 }, () => ({
    name: 'Dried meat',
    category: 'food',
    quality: 'standard',
    material: 'meat',
    weight: 1,
    value: 2,
    is_artifact: false,
    located_in_civ_id: civ.id,
    created_in_civ_id: civ.id,
    created_year: 1,
    position_x: FORTRESS_CENTER,
    position_y: FORTRESS_CENTER - 4,
    position_z: 0,
    properties: {},
  }));

  const { error: itemError } = await supabase.from('items').insert(startingItems);
  if (itemError) throw new Error(`Failed to create starting items: ${itemError.message}`);

  // Place a well and mushroom garden near fortress center (tiles for rendering)
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

  // Place structure records for well and mushroom garden so the sim engine can use them.
  // The sim reads from the `structures` table, not `fortress_tiles`, so both are needed.
  const startingStructures = [
    {
      civilization_id: civ.id,
      type: 'well',
      name: null,
      completion_pct: 100,
      built_year: 1,
      quality: 'standard',
      position_x: FORTRESS_CENTER + 3,
      position_y: FORTRESS_CENTER,
      position_z: 0,
    },
    {
      civilization_id: civ.id,
      type: 'mushroom_garden',
      name: null,
      completion_pct: 100,
      built_year: 1,
      quality: 'standard',
      position_x: FORTRESS_CENTER - 3,
      position_y: FORTRESS_CENTER,
      position_z: 0,
    },
  ];

  const { error: structureError } = await supabase.from('structures').insert(startingStructures);
  if (structureError) throw new Error(`Failed to create starting structures: ${structureError.message}`);

  // Place starting beds near fortress center (one per dwarf)
  const startingBeds = STARTING_OFFSETS.map((offset) => ({
    civilization_id: civ.id,
    type: 'bed',
    name: null,
    completion_pct: 100,
    built_year: 1,
    quality: 'standard',
    position_x: FORTRESS_CENTER + offset.dx,
    position_y: FORTRESS_CENTER + offset.dy + 2,
    position_z: 0,
  }));

  const { error: bedError } = await supabase.from('structures').insert(startingBeds);
  if (bedError) throw new Error(`Failed to place starting beds: ${bedError.message}`);

  // Place bed tiles for rendering
  const bedTiles = STARTING_OFFSETS.map((offset) => ({
    civilization_id: civ.id,
    x: FORTRESS_CENTER + offset.dx,
    y: FORTRESS_CENTER + offset.dy + 2,
    z: 0,
    tile_type: 'bed',
    material: 'wood',
    is_revealed: true,
    is_mined: false,
  }));

  const { error: bedTileError } = await supabase.from('fortress_tiles').insert(bedTiles);
  if (bedTileError) throw new Error(`Failed to place bed tiles: ${bedTileError.message}`);

  // Pre-create cave rows with terrain-derived properties
  const embarkTerrain = deriver.deriveTile(tileX, tileY).terrain as TerrainType;
  const fortressDeriver = createFortressDeriver(worldSeed, civ.id, embarkTerrain);
  const caveProps = TERRAIN_CAVE_PROPERTIES[embarkTerrain] ?? TERRAIN_CAVE_PROPERTIES.plains;

  if (fortressDeriver.entrances.length > 0) {
    const caveRows = fortressDeriver.entrances.map((entrance, i) => {
      const nameSeed = getCaveSeed(worldSeed, civ.id, entrance.x, entrance.y);
      return {
        civilization_id: civ.id,
        entrance_x: entrance.x,
        entrance_y: entrance.y,
        z_level: -(i + 1),
        name: generateCaveName(nameSeed),
        discovered: false,
        danger_level: caveProps.danger_level,
        resource_type: caveProps.resource_type,
      };
    });

    const { error: caveError } = await supabase.from('caves').insert(caveRows);
    if (caveError) throw new Error(`Failed to create caves: ${caveError.message}`);
  }

  return { id: civ.id, name: civ.name as string };
}

/** Terrain-derived cave properties set at embark time. */
const TERRAIN_CAVE_PROPERTIES: Record<string, { danger_level: number; resource_type: string | null }> = {
  mountain: { danger_level: 40, resource_type: 'ore' },
  forest:   { danger_level: 20, resource_type: 'mushroom' },
  plains:   { danger_level: 10, resource_type: null },
  desert:   { danger_level: 30, resource_type: null },
  tundra:   { danger_level: 20, resource_type: null },
  swamp:    { danger_level: 60, resource_type: 'mushroom' },
  volcano:  { danger_level: 80, resource_type: 'gem' },
};
