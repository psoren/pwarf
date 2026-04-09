import { STEPS_PER_YEAR, STEPS_PER_DAY } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import { pruneTerminalTasks } from "./flush-state.js";
import { simDebug } from "./sim-debug.js";
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
  jobClaiming,
  eventFiring,
  yearlyRollup,
  thoughtGeneration,
  haulAssignment,
  autoCookPhase,
  autoBrew,
  autoForage,
  taskRecovery,
  idleBehavior,
} from "./phases/index.js";

/** Phase definitions for timing instrumentation. */
const PHASES: Array<{ name: string; fn: (ctx: SimContext) => void | Promise<void> }> = [
  { name: 'needsDecay', fn: needsDecay },
  { name: 'taskExecution', fn: taskExecution },
  { name: 'needSatisfaction', fn: needSatisfaction },
  { name: 'stressUpdate', fn: stressUpdate },
  { name: 'tantrumCheck', fn: tantrumCheck },
  { name: 'tantrumActions', fn: tantrumActions },
  { name: 'monsterSpawning', fn: monsterSpawning },
  { name: 'monsterPathfinding', fn: monsterPathfinding },
  { name: 'combatResolution', fn: combatResolution },
  { name: 'haulAssignment', fn: haulAssignment },
  { name: 'taskRecovery', fn: taskRecovery },
  { name: 'autoCookPhase', fn: autoCookPhase },
  { name: 'autoBrew', fn: autoBrew },
  { name: 'autoForage', fn: autoForage },
  { name: 'idleBehavior', fn: idleBehavior },
  { name: 'jobClaiming', fn: jobClaiming },
  { name: 'eventFiring', fn: eventFiring },
  { name: 'thoughtGeneration', fn: thoughtGeneration },
];

/** Run all sim phases for one tick in deterministic order. */
export async function runTick(ctx: SimContext): Promise<void> {
  const timing = ctx.debug && ctx.step % 100 === 0;
  const tickStart = timing ? performance.now() : 0;

  for (const phase of PHASES) {
    const phaseStart = timing ? performance.now() : 0;
    await phase.fn(ctx);
    if (timing) {
      const elapsed = performance.now() - phaseStart;
      if (elapsed > 1) { // Only log phases taking > 1ms
        simDebug(ctx, 'timing', `${phase.name}: ${elapsed.toFixed(1)}ms`);
      }
    }
  }

  if (timing) {
    const totalMs = performance.now() - tickStart;
    simDebug(ctx, 'timing', `tick ${ctx.step} total: ${totalMs.toFixed(1)}ms (${ctx.state.dwarves.length} dwarves, ${ctx.state.tasks.length} tasks)`);
  }

  // Prune completed/cancelled/failed tasks every 100 ticks to prevent unbounded growth.
  // In live mode, flushState also prunes — this ensures headless mode stays clean too.
  if (ctx.step % 100 === 0) {
    pruneTerminalTasks(ctx.state);
  }
}

/** Advance day/year counters on a SimContext for the given step number. */
export function advanceTime(ctx: SimContext, step: number, currentYear: number): void {
  const spy = ctx.stepsPerYear ?? STEPS_PER_YEAR;
  const spd = ctx.stepsPerDay ?? STEPS_PER_DAY;
  const day = Math.floor((step % spy) / spd) + 1;
  ctx.step = step;
  ctx.day = day;
  ctx.year = currentYear;
}

/** Run yearly rollup if the step lands on a year boundary, updating ctx. Returns the new year. */
export async function maybeYearRollup(ctx: SimContext, step: number, currentYear: number): Promise<number> {
  const spy = ctx.stepsPerYear ?? STEPS_PER_YEAR;
  if (step % spy === 0) {
    const newYear = currentYear + 1;
    ctx.year = newYear;
    ctx.day = 1;
    await yearlyRollup(ctx);
    return newYear;
  }
  return currentYear;
}
