import type { Dwarf, DwarfRelationship, DwarfSkill, FortressTile, FortressTileType, RelationshipType, Task, TaskType, Item, Structure, Monster } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTestContext } from "../sim-context.js";
import { createRng, DEFAULT_TEST_SEED } from "../rng.js";

// Shared RNG for generating IDs in test factories — uses fixed seed for reproducibility
const _factoryRng = createRng(DEFAULT_TEST_SEED);

export function makeDwarf(overrides?: Partial<Dwarf>): Dwarf {
  return {
    id: _factoryRng.uuid(),
    civilization_id: "civ-1",
    name: "Urist",
    surname: "McTestdwarf",
    status: "alive",
    age: 30,
    gender: "male",
    need_food: 80,
    need_drink: 80,
    need_sleep: 80,
    need_social: 50,
    need_purpose: 0,
    need_beauty: 0,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    injuries: [],
    memories: [],
    trait_openness: null,
    trait_conscientiousness: null,
    trait_extraversion: null,
    trait_agreeableness: null,
    trait_neuroticism: null,
    religious_devotion: 0,
    faction_id: null,
    born_year: null,
    died_year: null,
    cause_of_death: null,
    current_task_id: null,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeSkill(dwarfId: string, skillName: string, level = 0, xp = 0): DwarfSkill {
  return {
    id: _factoryRng.uuid(),
    dwarf_id: dwarfId,
    skill_name: skillName,
    level,
    xp,
    last_used_year: null,
  };
}

export function makeItem(overrides?: Partial<Item>): Item {
  return {
    id: _factoryRng.uuid(),
    name: "Plump helmet",
    category: "food",
    quality: "standard",
    material: "plant",
    weight: 1,
    value: 2,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: "civ-1",
    created_year: 1,
    held_by_dwarf_id: null,
    located_in_civ_id: "civ-1",
    located_in_ruin_id: null,
    position_x: null,
    position_y: null,
    position_z: null,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeTask(task_type: TaskType, overrides?: Partial<Task>): Task {
  return {
    id: _factoryRng.uuid(),
    civilization_id: "civ-1",
    task_type,
    status: "claimed",
    priority: 5,
    assigned_dwarf_id: null,
    target_x: null,
    target_y: null,
    target_z: null,
    target_item_id: null,
    work_progress: 0,
    work_required: 100,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

/**
 * Create a fortress tile override for use in ScenarioConfig.fortressTileOverrides.
 * Useful for controlling tile types in scenario tests — e.g. placing a 'rock' tile
 * so a mine task produces a stone block, or placing 'tree' to produce wood.
 */
export function makeMapTile(
  x: number,
  y: number,
  z: number,
  tileType: FortressTileType,
  overrides?: Partial<FortressTile>,
): FortressTile {
  return {
    id: _factoryRng.uuid(),
    civilization_id: "civ-1",
    x,
    y,
    z,
    tile_type: tileType,
    material: null,
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeStructure(overrides?: Partial<Structure>): Structure {
  return {
    id: _factoryRng.uuid(),
    civilization_id: "civ-1",
    name: null,
    type: "bed",
    completion_pct: 100,
    built_year: 1,
    ruin_id: null,
    quality: "standard",
    notes: null,
    position_x: 0,
    position_y: 0,
    position_z: 0,
    occupied_by_dwarf_id: null,
    ...overrides,
  };
}

export function makeRelationship(
  dwarfAId: string,
  dwarfBId: string,
  type: RelationshipType = "acquaintance",
  overrides?: Partial<DwarfRelationship>,
): DwarfRelationship {
  const [aId, bId] = dwarfAId < dwarfBId ? [dwarfAId, dwarfBId] : [dwarfBId, dwarfAId];
  return {
    id: _factoryRng.uuid(),
    dwarf_a_id: aId,
    dwarf_b_id: bId,
    type,
    strength: 1,
    shared_events: [],
    formed_year: 1,
    ...overrides,
  };
}

export function makeMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: _factoryRng.uuid(),
    world_id: "world-1",
    name: "Grakzel",
    epithet: null,
    type: "night_creature",
    status: "active",
    behavior: "aggressive",
    is_named: false,
    lair_tile_x: 20,
    lair_tile_y: 20,
    current_tile_x: 20,
    current_tile_y: 20,
    threat_level: 30,
    health: 50,
    size_category: "medium",
    body_parts: [],
    attacks: [],
    abilities: [],
    weaknesses: [],
    lore: null,
    origin_myth: null,
    properties: {},
    first_seen_year: 1,
    slain_year: null,
    slain_by_dwarf_id: null,
    slain_in_civ_id: null,
    slain_in_ruin_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeContext(opts?: {
  dwarves?: Dwarf[];
  skills?: DwarfSkill[];
  tasks?: Task[];
  items?: Item[];
  structures?: Structure[];
}, seed?: number): SimContext {
  return createTestContext(opts, seed);
}
