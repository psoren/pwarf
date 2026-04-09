import type { Dwarf, DwarfRelationship, DwarfSkill, FortressTile, FortressTileType, RelationshipType, Ruin, StockpileTile, Task, TaskType, Item, Structure, Monster } from "@pwarf/shared";
import { SKILL_NAMES, createFortressDeriver } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTestContext } from "../sim-context.js";
import { createRng, DEFAULT_TEST_SEED } from "../rng.js";
import type { ScenarioConfig } from "../run-scenario.js";

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
    memories: [],
    trait_openness: null,
    trait_conscientiousness: null,
    trait_extraversion: null,
    trait_agreeableness: null,
    trait_neuroticism: null,
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
    lore: null,
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

export function makeRuin(overrides?: Partial<Ruin>): Ruin {
  return {
    id: _factoryRng.uuid(),
    civilization_id: "ancient-civ-1",
    world_id: "world-1",
    name: "The Fallen Hall",
    tile_x: 10,
    tile_y: 10,
    fallen_year: -100,
    cause_of_death: "unknown",
    original_wealth: 5000,
    remaining_wealth: 5000,
    peak_population: 20,
    danger_level: 30,
    is_contaminated: false,
    contamination_type: null,
    ghost_count: 0,
    is_trapped: false,
    resident_monster_id: null,
    snapshot: null,
    snapshot_url: null,
    is_published: false,
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

/**
 * Create a realistic scenario config with multiple dwarves, stocked food/drink,
 * beds, a well, stockpile tiles, and a fortress deriver. Designed to suppress
 * autonomous survival distractions so tests can focus on the feature under test.
 */
export function makeRealisticScenario(overrides?: Partial<ScenarioConfig> & {
  dwarfCount?: number;
  foodCount?: number;
  drinkCount?: number;
}): ScenarioConfig {
  const { dwarfCount = 3, foodCount = 20, drinkCount = 20, ...scenarioOverrides } = overrides ?? {};

  const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

  // Create dwarves at staggered positions near fortress center
  const dwarves: Dwarf[] = [];
  const dwarfSkills: DwarfSkill[] = [];
  for (let i = 0; i < dwarfCount; i++) {
    const dwarf = makeDwarf({
      civilization_id: "test-civ",
      position_x: 256 + (i % 3),
      position_y: 256 + Math.floor(i / 3),
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
      need_social: 80,
    });
    dwarves.push(dwarf);
    for (const skill of SKILL_NAMES) {
      dwarfSkills.push(makeSkill(dwarf.id, skill, 2));
    }
  }

  // Food items
  const items: Item[] = [];
  for (let i = 0; i < foodCount; i++) {
    items.push(makeItem({
      name: "Plump helmet",
      category: "food",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: 258,
      position_y: 258,
      position_z: 0,
    }));
  }
  // Drink items
  for (let i = 0; i < drinkCount; i++) {
    items.push(makeItem({
      name: "Dwarven ale",
      category: "drink",
      material: "plant",
      located_in_civ_id: "test-civ",
      position_x: 258,
      position_y: 258,
      position_z: 0,
    }));
  }

  // 3x3 stockpile grid at (250-252, 262-264, 0)
  const stockpileTiles: StockpileTile[] = [];
  for (let sx = 250; sx <= 252; sx++) {
    for (let sy = 262; sy <= 264; sy++) {
      stockpileTiles.push({
        id: _factoryRng.uuid(),
        civilization_id: "test-civ",
        x: sx,
        y: sy,
        z: 0,
        priority: 1,
        accepts_categories: null,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 7 beds
  const structures: Structure[] = [];
  for (let i = 0; i < 7; i++) {
    structures.push(makeStructure({
      civilization_id: "test-civ",
      type: "bed",
      completion_pct: 100,
      position_x: 254 + i,
      position_y: 260,
      position_z: 0,
    }));
  }
  // 1 well
  structures.push(makeStructure({
    civilization_id: "test-civ",
    type: "well",
    completion_pct: 100,
    position_x: 260,
    position_y: 258,
    position_z: 0,
  }));
  // 1 still (for brewing)
  structures.push(makeStructure({
    civilization_id: "test-civ",
    type: "still",
    completion_pct: 100,
    position_x: 258,
    position_y: 256,
    position_z: 0,
  }));
  // 1 kitchen (for cooking)
  structures.push(makeStructure({
    civilization_id: "test-civ",
    type: "kitchen",
    completion_pct: 100,
    position_x: 256,
    position_y: 256,
    position_z: 0,
  }));

  return {
    dwarves,
    dwarfSkills,
    items,
    structures,
    stockpileTiles,
    fortressDeriver,
    ticks: 500,
    seed: 42,
    ...scenarioOverrides,
  };
}
