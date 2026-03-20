import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dwarf, DwarfSkill, Task, Item, Structure } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";

export function makeDwarf(overrides?: Partial<Dwarf>): Dwarf {
  return {
    id: randomUUID(),
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
    need_purpose: 50,
    need_beauty: 50,
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
    id: randomUUID(),
    dwarf_id: dwarfId,
    skill_name: skillName,
    level,
    xp,
    last_used_year: null,
  };
}

export function makeItem(overrides?: Partial<Item>): Item {
  return {
    id: randomUUID(),
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

export function makeStructure(overrides?: Partial<Structure>): Structure {
  return {
    id: randomUUID(),
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

export function makeContext(opts?: {
  dwarves?: Dwarf[];
  skills?: DwarfSkill[];
  tasks?: Task[];
  items?: Item[];
  structures?: Structure[];
}): SimContext {
  const state = createEmptyCachedState();
  state.dwarves = opts?.dwarves ?? [];
  state.dwarfSkills = opts?.skills ?? [];
  state.tasks = opts?.tasks ?? [];
  state.items = opts?.items ?? [];
  state.structures = opts?.structures ?? [];

  return {
    supabase: null as unknown as SupabaseClient,
    civilizationId: "civ-1",
    worldId: "world-1",
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    state,
  };
}
