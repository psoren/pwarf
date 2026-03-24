import type { Dwarf, DwarfSkill, FortressTile, Item, Task } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { createRng, type Rng } from "./rng.js";

/** All skill names that dwarves can have. */
const ALL_SKILLS = ['mining', 'farming', 'building', 'engraving', 'brewing', 'cooking', 'smithing'] as const;

export interface ScenarioDefinition {
  name: string;
  description: string;
  seed: number;
  dwarfCount: number;
  initialFood: number;
  initialDrink: number;
  defaultTicks: number;
}

export const SCENARIOS: Record<string, ScenarioDefinition> = {
  starvation: {
    name: "starvation",
    description: "Scarce food supply — will dwarves starve before finding alternatives?",
    seed: 42,
    dwarfCount: 7,
    initialFood: 3,
    initialDrink: 20,
    defaultTicks: 500,
  },
  "idle-fortress": {
    name: "idle-fortress",
    description: "Plenty of food and drink but no tasks designated — do dwarves go idle?",
    seed: 99,
    dwarfCount: 7,
    initialFood: 30,
    initialDrink: 30,
    defaultTicks: 300,
  },
  "long-run-stability": {
    name: "long-run-stability",
    description: "Balanced starting conditions — regression check for crashes and stuck states over many ticks.",
    seed: 1337,
    dwarfCount: 7,
    initialFood: 20,
    initialDrink: 20,
    defaultTicks: 5000,
  },
  overcrowding: {
    name: "overcrowding",
    description: "More dwarves than resources — tests stress accumulation and social need collapse.",
    seed: 7,
    dwarfCount: 20,
    initialFood: 10,
    initialDrink: 10,
    defaultTicks: 500,
  },
};

function makeDwarf(rng: Rng, civId: string, index: number, needFood: number, needDrink: number): Dwarf {
  const names = [
    "Urist", "Zon", "Meng", "Datan", "Reg", "Ast", "Domas",
    "Logem", "Onol", "Sodel", "Iden", "Bim", "Erith", "Kubuk",
    "Tosid", "Mosus", "Avuz", "Rigoth", "Nish", "Edem",
  ];
  const surnames = [
    "McTestdwarf", "Hammerfall", "Stonebrew", "Axebeard", "Ironpick",
    "Gravelfoot", "Deepdelver", "Boulderback", "Caveshout", "Flintmark",
    "Slatefist", "Copperkettle", "Graniteborn", "Quarrytoe", "Minechant",
    "Boulderhew", "Rocksong", "Dirtplow", "Crystalvein", "Shadowdig",
  ];

  return {
    id: rng.uuid(),
    civilization_id: civId,
    name: names[index % names.length] ?? "Urist",
    surname: surnames[index % surnames.length] ?? "McTestdwarf",
    status: "alive",
    age: 25 + (index % 20),
    gender: index % 2 === 0 ? "male" : "female",
    need_food: needFood + rng.int(-10, 10),
    need_drink: needDrink + rng.int(-10, 10),
    need_sleep: 70 + rng.int(0, 20),
    need_social: 40 + rng.int(0, 20),
    need_purpose: 0,
    need_beauty: 0,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    memories: [],
    trait_openness: 0.1 + rng.random() * 0.8,
    trait_conscientiousness: 0.1 + rng.random() * 0.8,
    trait_extraversion: 0.1 + rng.random() * 0.8,
    trait_agreeableness: 0.1 + rng.random() * 0.8,
    trait_neuroticism: 0.1 + rng.random() * 0.8,
    born_year: null,
    died_year: null,
    cause_of_death: null,
    current_task_id: null,
    position_x: 100 + (index % 5),
    position_y: 100 + Math.floor(index / 5),
    position_z: 0,
    created_at: new Date().toISOString(),
  };
}

function makeFood(rng: Rng, civId: string, count: number): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: rng.uuid(),
      name: "Plump helmet",
      category: "food",
      quality: "standard",
      material: "plant",
      weight: 1,
      value: 2,
      is_artifact: false,
      created_by_dwarf_id: null,
      created_in_civ_id: civId,
      created_year: 1,
      held_by_dwarf_id: null,
      located_in_civ_id: civId,
      located_in_ruin_id: null,
      position_x: 100 + (i % 10),
      position_y: 95,
      position_z: 0,
      lore: null,
      properties: {},
      created_at: new Date().toISOString(),
    });
  }
  return items;
}

function makeDrink(rng: Rng, civId: string, count: number): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: rng.uuid(),
      name: "Dwarven ale",
      category: "drink",
      quality: "standard",
      material: "plant",
      weight: 1,
      value: 3,
      is_artifact: false,
      created_by_dwarf_id: null,
      created_in_civ_id: civId,
      created_year: 1,
      held_by_dwarf_id: null,
      located_in_civ_id: civId,
      located_in_ruin_id: null,
      position_x: 101 + (i % 10),
      position_y: 96,
      position_z: 0,
      lore: null,
      properties: {},
      created_at: new Date().toISOString(),
    });
  }
  return items;
}

/**
 * Generate skill records for a dwarf. Each dwarf gets all skills at level 0
 * so they can claim any task. A few random skills get a small level boost
 * to create specialization and differentiate dwarves.
 */
function makeSkills(rng: Rng, dwarfId: string): DwarfSkill[] {
  return ALL_SKILLS.map(skillName => ({
    id: rng.uuid(),
    dwarf_id: dwarfId,
    skill_name: skillName,
    level: rng.random() < 0.3 ? rng.int(1, 3) : 0,
    xp: 0,
    last_used_year: null,
  }));
}

/** Build initial CachedState from a scenario definition. */
export function buildScenarioState(scenario: ScenarioDefinition): CachedState {
  const rng = createRng(scenario.seed);
  const civId = "headless-civ";
  const state = createEmptyCachedState();

  // Dwarves start with full needs so food/drink scarcity is tested by supply, not starting levels
  const needFood = scenario.initialFood === 0 ? 80 : 80;
  const needDrink = scenario.initialDrink === 0 ? 80 : 80;

  state.dwarves = Array.from({ length: scenario.dwarfCount }, (_, i) =>
    makeDwarf(rng, civId, i, needFood, needDrink)
  );

  // Give every dwarf all skills so they can claim any task type
  for (const dwarf of state.dwarves) {
    state.dwarfSkills.push(...makeSkills(rng, dwarf.id));
  }

  state.items = [
    ...makeFood(rng, civId, scenario.initialFood),
    ...makeDrink(rng, civId, scenario.initialDrink),
  ];

  // Add forageable surface tiles so autoForage can trigger when food runs low
  const forageableTiles: FortressTile[] = [
    { id: rng.uuid(), civilization_id: civId, x: 90, y: 100, z: 0, tile_type: 'grass', material: null, is_revealed: true, is_mined: false, created_at: new Date().toISOString() },
    { id: rng.uuid(), civilization_id: civId, x: 91, y: 100, z: 0, tile_type: 'bush', material: null, is_revealed: true, is_mined: false, created_at: new Date().toISOString() },
    { id: rng.uuid(), civilization_id: civId, x: 92, y: 100, z: 0, tile_type: 'tree', material: null, is_revealed: true, is_mined: false, created_at: new Date().toISOString() },
  ];
  for (const tile of forageableTiles) {
    state.fortressTileOverrides.set(`${tile.x},${tile.y},${tile.z}`, tile);
  }

  return state;
}

/** Build eat/drink tasks so dwarves know where food is. */
export function buildEatDrinkTasks(state: CachedState, seed = 0): Task[] {
  const rng = createRng(seed);
  const civId = "headless-civ";
  const tasks: Task[] = [];

  for (const item of state.items) {
    if (item.position_x == null || item.position_y == null || item.position_z == null) continue;
    if (item.category === "food") {
      tasks.push({
        id: rng.uuid(),
        civilization_id: civId,
        task_type: "eat",
        status: "pending",
        priority: 5,
        assigned_dwarf_id: null,
        target_x: item.position_x,
        target_y: item.position_y,
        target_z: item.position_z,
        target_item_id: item.id,
        work_progress: 0,
        work_required: 10,
        created_at: new Date().toISOString(),
        completed_at: null,
      });
    } else if (item.category === "drink") {
      tasks.push({
        id: rng.uuid(),
        civilization_id: civId,
        task_type: "drink",
        status: "pending",
        priority: 5,
        assigned_dwarf_id: null,
        target_x: item.position_x,
        target_y: item.position_y,
        target_z: item.position_z,
        target_item_id: item.id,
        work_progress: 0,
        work_required: 10,
        created_at: new Date().toISOString(),
        completed_at: null,
      });
    }
  }

  return tasks;
}
