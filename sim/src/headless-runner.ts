import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { createRng } from "./rng.js";
import { runTick, advanceTime, maybeYearRollup } from "./tick.js";
import { pruneTerminalTasks } from "./task-pruning.js";
import { SCENARIOS, buildScenarioState, buildEatDrinkTasks } from "./scenarios.js";
import { serializeState } from "./state-serializer.js";
import type { StateSnapshot, ActionLogEntry } from "./state-serializer.js";
import type { ScenarioDefinition } from "./scenarios.js";
import type { CachedState } from "./sim-context.js";

/** Prune terminal tasks every N ticks to prevent unbounded growth. */
const PRUNE_INTERVAL = 2000;

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
  /** Chronological log of AI actions/events that occurred during the run. */
  actionLog: ActionLogEntry[];
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
    // Rebuild task index after bulk push
    for (const t of state.tasks) state.taskById.set(t.id, t);
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
    advanceTime(ctx, stepCount, currentYear);

    const tasksBefore = state.tasks.filter(t => t.status === "completed").length;
    await runTick(ctx);
    const tasksAfter = state.tasks.filter(t => t.status === "completed").length;
    tasksCompleted += tasksAfter - tasksBefore;

    currentYear = await maybeYearRollup(ctx, stepCount, currentYear);

    // Periodically prune terminal tasks to prevent unbounded growth.
    if (i > 0 && i % PRUNE_INTERVAL === 0) {
      pruneTerminalTasks(state, true);
    }

    // Flush pendingEvents → worldEvents (mirrors what run-scenario does)
    if (state.pendingEvents.length > 0) {
      state.worldEvents.push(...state.pendingEvents);
      state.pendingEvents = [];
    }

    if (snapshotEvery > 0 && stepCount % snapshotEvery === 0) {
      snapshots.push(serializeState(ctx, tasksCompleted));
    }
  }

  const finalSnapshot = serializeState(ctx, tasksCompleted);

  const actionLog: ActionLogEntry[] = state.worldEvents.map(e => ({
    tick: e.year,
    category: e.category,
    description: e.description,
    ...(Object.keys(e.event_data).length > 0 ? { details: e.event_data } : {}),
  }));

  return { finalSnapshot, snapshots, tasksCompleted, ticks: stepCount, actionLog };
}
