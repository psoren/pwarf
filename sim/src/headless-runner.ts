import type { SupabaseClient } from "@supabase/supabase-js";
import { STEPS_PER_YEAR, STEPS_PER_DAY } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { createRng } from "./rng.js";
import {
  needsDecay,
  taskExecution,
  needSatisfaction,
  stressUpdate,
  tantrumCheck,
  tantrumActions,
  monsterSpawning,
  monsterPathfinding,
  combatResolution,
  constructionProgress,
  jobClaiming,
  eventFiring,
  yearlyRollup,
  idleWandering,
  thoughtGeneration,
  haulAssignment,
  autoCookPhase,
  autoBrew,
  autoForage,
  taskRecovery,
} from "./phases/index.js";
import { SCENARIOS, buildScenarioState, buildEatDrinkTasks } from "./scenarios.js";
import { serializeState } from "./state-serializer.js";
import type { StateSnapshot } from "./state-serializer.js";
import type { ScenarioDefinition } from "./scenarios.js";
import type { CachedState } from "./sim-context.js";

export interface HeadlessRunOptions {
  /** Scenario name from SCENARIOS map, or null to use custom initialState. */
  scenario?: string;
  /** Override the number of ticks to run. */
  ticks?: number;
  /** Emit a snapshot every N ticks (0 = only final snapshot). */
  snapshotEvery?: number;
  /** Custom initial state (used when scenario is not provided). */
  initialState?: CachedState;
}

export interface HeadlessRunResult {
  /** Final snapshot at the last tick. */
  finalSnapshot: StateSnapshot;
  /** Intermediate snapshots (if snapshotEvery > 0). */
  snapshots: StateSnapshot[];
  /** Total tasks completed during the run. */
  tasksCompleted: number;
  /** Total ticks executed. */
  ticks: number;
}

/**
 * Run the sim engine entirely in memory — no Supabase, no timers, no browser.
 *
 * This is the core of the automated playtesting system. It runs all phases
 * in deterministic order for the given number of ticks and returns a
 * structured result suitable for LLM analysis.
 */
export async function runHeadless(opts: HeadlessRunOptions): Promise<HeadlessRunResult> {
  let scenarioDef: ScenarioDefinition | null = null;
  let state: CachedState;

  if (opts.scenario) {
    scenarioDef = SCENARIOS[opts.scenario] ?? null;
    if (!scenarioDef) {
      throw new Error(`Unknown scenario "${opts.scenario}". Available: ${Object.keys(SCENARIOS).join(", ")}`);
    }
    state = buildScenarioState(scenarioDef);
    // Pre-populate eat/drink tasks so dwarves know where food/drink is
    state.tasks.push(...buildEatDrinkTasks(state));
  } else if (opts.initialState) {
    state = opts.initialState;
  } else {
    state = createEmptyCachedState();
  }

  const ticks = opts.ticks ?? scenarioDef?.defaultTicks ?? 500;
  const snapshotEvery = opts.snapshotEvery ?? 0;

  const ctx: SimContext = {
    supabase: null as unknown as SupabaseClient,
    civilizationId: "headless-civ",
    worldId: "headless-world",
    civName: "Headless Fortress",
    civTileX: 0,
    civTileY: 0,
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(scenarioDef?.seed ?? 0),
    state,
  };

  const snapshots: StateSnapshot[] = [];
  let tasksCompleted = 0;
  let stepCount = 0;
  let currentYear = 1;

  for (let i = 0; i < ticks; i++) {
    stepCount++;
    const currentDay = Math.floor((stepCount % STEPS_PER_YEAR) / STEPS_PER_DAY) + 1;
    ctx.step = stepCount;
    ctx.day = currentDay;
    ctx.year = currentYear;

    const tasksBefore = state.tasks.filter(t => t.status === "completed").length;

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

    if (stepCount % STEPS_PER_YEAR === 0) {
      currentYear++;
      ctx.year = currentYear;
      ctx.day = 1;
      await yearlyRollup(ctx);
    }

    const tasksAfter = state.tasks.filter(t => t.status === "completed").length;
    tasksCompleted += tasksAfter - tasksBefore;

    if (snapshotEvery > 0 && stepCount % snapshotEvery === 0) {
      snapshots.push(serializeState(ctx, tasksCompleted));
    }
  }

  const finalSnapshot = serializeState(ctx, tasksCompleted);

  return { finalSnapshot, snapshots, tasksCompleted, ticks: stepCount };
}
