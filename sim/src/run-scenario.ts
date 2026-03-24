import type { SupabaseClient } from "@supabase/supabase-js";
import { STEPS_PER_YEAR, STEPS_PER_DAY } from "@pwarf/shared";
import type { Dwarf, DwarfSkill, FortressTile, Item, Structure, Monster, Task, WorldEvent, StockpileTile } from "@pwarf/shared";
import type { SimContext, CachedState } from "./sim-context.js";
import { createEmptyCachedState, createRng } from "./sim-context.js";
import { DEFAULT_TEST_SEED } from "./rng.js";
import {
  needsDecay,
  taskExecution,
  needSatisfaction,
  stressUpdate,
  tantrumCheck,
  tantrumActions,
  monsterPathfinding,
  combatResolution,
  constructionProgress,
  jobClaiming,
  eventFiring,
  yearlyRollup,
  idleWandering,
  thoughtGeneration,
  haulAssignment,
  beautyRestoration,
  haunting,
  autoCookPhase,
  autoBrew,
  autoForage,
  taskRecovery,
  monsterSpawning,
} from "./phases/index.js";

/** Input configuration for a scenario run. */
export interface ScenarioConfig {
  dwarves?: Dwarf[];
  /** Dwarf skill records — required for any scenario that tests skilled tasks (build, mine, farm). */
  dwarfSkills?: DwarfSkill[];
  items?: Item[];
  structures?: Structure[];
  monsters?: Monster[];
  tasks?: Task[];
  /** Pre-placed fortress tiles — bypasses the fortress deriver for controlled map fixtures. */
  fortressTileOverrides?: FortressTile[];
  /** Pre-infected dwarf IDs — seeds the disease system without relying on the outbreak roll. */
  infectedDwarfIds?: string[];
  /** Pre-registered ghost dwarf IDs — these dead dwarves haunt living dwarves from tick 0. */
  ghostDwarfIds?: string[];
  /** Pre-placed stockpile tiles for haul testing. */
  stockpileTiles?: StockpileTile[];
  ticks: number;
  seed?: number;
}

/** Full final state returned after a scenario run — suitable for test assertions. */
export interface ScenarioResult {
  /** Final state of all dwarves (includes dead dwarves). */
  dwarves: Dwarf[];
  /** Final item state. */
  items: Item[];
  /** Final structure state. */
  structures: Structure[];
  /** All events fired during the run. */
  events: WorldEvent[];
  /** All tasks at end of run. */
  tasks: Task[];
  /** Total ticks executed. */
  ticks: number;
  /** Final in-game year. */
  year: number;
  /** All fortress tile overrides (mined/built tiles) at end of run. */
  fortressTileOverrides: FortressTile[];
}

/**
 * Run the sim engine in-memory for exactly `ticks` iterations.
 *
 * No Supabase, no timers, no browser. Uses seeded RNG for deterministic
 * results. Suitable for unit tests and scenario assertions.
 */
export async function runScenario(config: ScenarioConfig): Promise<ScenarioResult> {
  const seed = config.seed ?? DEFAULT_TEST_SEED;
  const state: CachedState = createEmptyCachedState();
  // Deep-copy all input entities so mutations during the run don't affect the caller's objects
  state.dwarves = config.dwarves ? config.dwarves.map(d => ({ ...d })) : [];
  state.dwarfSkills = config.dwarfSkills ? config.dwarfSkills.map(s => ({ ...s })) : [];
  state.items = config.items ? config.items.map(i => ({ ...i })) : [];
  state.structures = config.structures ? config.structures.map(s => ({ ...s })) : [];
  state.monsters = config.monsters ? config.monsters.map(m => ({ ...m })) : [];
  state.tasks = config.tasks ? config.tasks.map(t => ({ ...t })) : [];
  if (config.fortressTileOverrides) {
    for (const tile of config.fortressTileOverrides) {
      state.fortressTileOverrides.set(`${tile.x},${tile.y},${tile.z}`, { ...tile });
    }
  }
  if (config.infectedDwarfIds) {
    for (const id of config.infectedDwarfIds) {
      state.infectedDwarfIds.add(id);
    }
  }
  if (config.ghostDwarfIds) {
    for (const id of config.ghostDwarfIds) {
      state.ghostDwarfIds.add(id);
    }
  }
  if (config.stockpileTiles) {
    for (const tile of config.stockpileTiles) {
      state.stockpileTiles.set(`${tile.x},${tile.y},${tile.z}`, { ...tile });
    }
  }

  const ctx: SimContext = {
    supabase: null as unknown as SupabaseClient,
    civilizationId: "test-civ",
    worldId: "test-world",
    civName: "Test Fortress",
    civTileX: 0,
    civTileY: 0,
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(seed),
    state,
  };

  // Accumulate all events fired across the run
  const allEvents: WorldEvent[] = [];
  let stepCount = 0;
  let currentYear = 1;

  for (let i = 0; i < config.ticks; i++) {
    stepCount++;
    const currentDay = Math.floor((stepCount % STEPS_PER_YEAR) / STEPS_PER_DAY) + 1;
    ctx.step = stepCount;
    ctx.day = currentDay;
    ctx.year = currentYear;

    await needsDecay(ctx);
    await taskExecution(ctx);
    await needSatisfaction(ctx);
    await stressUpdate(ctx);
    await tantrumCheck(ctx);
    await tantrumActions(ctx);
    await monsterSpawning(ctx);
    await monsterPathfinding(ctx);
    await combatResolution(ctx);
    await constructionProgress(ctx);
    await idleWandering(ctx);
    await haulAssignment(ctx);
    taskRecovery(ctx);
    await autoCookPhase(ctx);
    await autoBrew(ctx);
    await autoForage(ctx);
    await jobClaiming(ctx);
    await eventFiring(ctx);
    await thoughtGeneration(ctx);
    await beautyRestoration(ctx);
    await haunting(ctx);

    if (stepCount % STEPS_PER_YEAR === 0) {
      currentYear++;
      ctx.year = currentYear;
      ctx.day = 1;
      await yearlyRollup(ctx);
    }

    // Flush pendingEvents → worldEvents (mirrors what flush-state does for the DB)
    if (state.pendingEvents.length > 0) {
      state.worldEvents.push(...state.pendingEvents);
      state.pendingEvents = [];
    }
    allEvents.push(...state.worldEvents.slice(allEvents.length));
  }

  return {
    dwarves: state.dwarves,
    items: state.items,
    structures: state.structures,
    events: allEvents,
    tasks: state.tasks,
    ticks: stepCount,
    year: currentYear,
    fortressTileOverrides: [...state.fortressTileOverrides.values()],
  };
}
