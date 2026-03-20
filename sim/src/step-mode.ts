import type { SupabaseClient } from "@supabase/supabase-js";
import { STEPS_PER_YEAR } from "@pwarf/shared";
import type { TaskType } from "@pwarf/shared";
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
  beautyRestoration,
  haunting,
} from "./phases/index.js";
import { SCENARIOS, buildScenarioState, buildEatDrinkTasks } from "./scenarios.js";
import { serializeState } from "./state-serializer.js";

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export interface TickCommand {
  command: "tick";
  count?: number;
}

export interface StateCommand {
  command: "state";
}

export interface DesignateCommand {
  command: "designate";
  type: TaskType;
  x: number;
  y: number;
  z: number;
}

export interface CancelCommand {
  command: "cancel";
  taskId: string;
}

export interface ScenarioCommand {
  command: "scenario";
  name: string;
}

export type StepCommand =
  | TickCommand
  | StateCommand
  | DesignateCommand
  | CancelCommand
  | ScenarioCommand;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface OkResponse {
  ok: true;
  task_id?: string;
}

export interface ErrorResponse {
  ok: false;
  error: string;
}

export type CommandResponse = OkResponse | ErrorResponse | ReturnType<typeof serializeState>;

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

export interface StepSession {
  ctx: SimContext;
  step: number;
  year: number;
  day: number;
  tasksCompleted: number;
}

function makeTaskId(): string {
  return `step-task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Tick helper
// ---------------------------------------------------------------------------

async function runOneTick(session: StepSession): Promise<void> {
  const { ctx } = session;
  session.step++;
  session.day++;
  ctx.step = session.step;
  ctx.day = session.day;
  ctx.year = session.year;

  const before = ctx.state.tasks.filter(t => t.status === "completed").length;

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
  await jobClaiming(ctx);
  await eventFiring(ctx);
  await thoughtGeneration(ctx);
  await beautyRestoration(ctx);
  await haunting(ctx);

  if (session.step % STEPS_PER_YEAR === 0) {
    session.year++;
    session.day = 1;
    ctx.year = session.year;
    ctx.day = session.day;
    await yearlyRollup(ctx);
  }

  const after = ctx.state.tasks.filter(t => t.status === "completed").length;
  session.tasksCompleted += after - before;
}

// ---------------------------------------------------------------------------
// Command dispatcher
// ---------------------------------------------------------------------------

export async function dispatchCommand(
  session: StepSession,
  cmd: StepCommand
): Promise<CommandResponse> {
  switch (cmd.command) {
    case "tick": {
      const count = Math.max(1, cmd.count ?? 1);
      for (let i = 0; i < count; i++) {
        await runOneTick(session);
      }
      return serializeState(session.ctx, session.tasksCompleted);
    }

    case "state": {
      return serializeState(session.ctx, session.tasksCompleted);
    }

    case "designate": {
      const { type, x, y, z } = cmd;
      const taskId = makeTaskId();
      session.ctx.state.tasks.push({
        id: taskId,
        civilization_id: session.ctx.civilizationId,
        task_type: type,
        status: "pending",
        priority: 5,
        assigned_dwarf_id: null,
        target_x: x,
        target_y: y,
        target_z: z,
        target_item_id: null,
        work_progress: 0,
        work_required: 100,
        created_at: new Date().toISOString(),
        completed_at: null,
      });
      return { ok: true, task_id: taskId };
    }

    case "cancel": {
      const task = session.ctx.state.tasks.find(t => t.id === cmd.taskId);
      if (!task) {
        return { ok: false, error: `Task ${cmd.taskId} not found` };
      }
      if (task.status === "completed" || task.status === "cancelled") {
        return { ok: false, error: `Task ${cmd.taskId} is already ${task.status}` };
      }
      task.status = "cancelled";
      if (task.assigned_dwarf_id) {
        const dwarf = session.ctx.state.dwarves.find(d => d.id === task.assigned_dwarf_id);
        if (dwarf) {
          dwarf.current_task_id = null;
        }
      }
      return { ok: true };
    }

    case "scenario": {
      const scenarioDef = SCENARIOS[cmd.name];
      if (!scenarioDef) {
        return {
          ok: false,
          error: `Unknown scenario "${cmd.name}". Available: ${Object.keys(SCENARIOS).join(", ")}`,
        };
      }
      const state = buildScenarioState(scenarioDef);
      state.tasks.push(...buildEatDrinkTasks(state));
      session.ctx.state = state;
      session.ctx.rng = createRng(scenarioDef.seed);
      session.ctx.civilizationId = "step-civ";
      session.step = 0;
      session.year = 1;
      session.day = 1;
      session.tasksCompleted = 0;
      session.ctx.step = 0;
      session.ctx.year = 1;
      session.ctx.day = 1;
      return { ok: true };
    }

    default: {
      const exhaustive: never = cmd;
      return { ok: false, error: `Unknown command: ${(exhaustive as StepCommand).command}` };
    }
  }
}

// ---------------------------------------------------------------------------
// Session factory
// ---------------------------------------------------------------------------

export interface StepModeOptions {
  seed?: number;
  scenario?: string;
  dwarves?: number;
}

export function createStepSession(opts: StepModeOptions = {}): StepSession {
  const seed = opts.seed ?? 0;
  let state = createEmptyCachedState();

  if (opts.scenario) {
    const scenarioDef = SCENARIOS[opts.scenario];
    if (!scenarioDef) {
      throw new Error(`Unknown scenario "${opts.scenario}". Available: ${Object.keys(SCENARIOS).join(", ")}`);
    }
    state = buildScenarioState(scenarioDef);
    state.tasks.push(...buildEatDrinkTasks(state));
  }

  const ctx: SimContext = {
    supabase: null as unknown as SupabaseClient,
    civilizationId: "step-civ",
    worldId: "step-world",
    civName: "Step Fortress",
    civTileX: 0,
    civTileY: 0,
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(seed),
    state,
  };

  return {
    ctx,
    step: 0,
    year: 1,
    day: 1,
    tasksCompleted: 0,
  };
}

// ---------------------------------------------------------------------------
// Stdin/stdout loop (for CLI use)
// ---------------------------------------------------------------------------

export async function runStepMode(opts: StepModeOptions = {}): Promise<void> {
  const session = createStepSession(opts);

  process.stdout.write(JSON.stringify({ ready: true, scenario: opts.scenario ?? null }) + "\n");

  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let cmd: StepCommand;
    try {
      cmd = JSON.parse(trimmed) as StepCommand;
    } catch {
      process.stdout.write(JSON.stringify({ ok: false, error: "Invalid JSON" }) + "\n");
      continue;
    }

    const response = await dispatchCommand(session, cmd);
    process.stdout.write(JSON.stringify(response) + "\n");
  }
}
