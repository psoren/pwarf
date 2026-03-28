import { STEPS_PER_YEAR, STEPS_PER_DAY } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
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
} from "./phases/index.js";

/** Phase descriptor for tick timing. */
interface PhaseEntry {
  name: string;
  fn: (ctx: SimContext) => void | Promise<void>;
}

const PHASES: PhaseEntry[] = [
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
  { name: 'jobClaiming', fn: jobClaiming },
  { name: 'eventFiring', fn: eventFiring },
  { name: 'thoughtGeneration', fn: thoughtGeneration },
];

/** Run all sim phases for one tick in deterministic order. */
export async function runTick(ctx: SimContext): Promise<void> {
  const debug = ctx.debug;
  if (debug) {
    debug.setStep(ctx.step);
    const timings: Record<string, number> = {};
    const tickStart = performance.now();
    for (const phase of PHASES) {
      const start = performance.now();
      await phase.fn(ctx);
      timings[phase.name] = performance.now() - start;
    }
    const totalMs = performance.now() - tickStart;
    debug.warn('tick_timing', `Tick ${ctx.step} took ${totalMs.toFixed(1)}ms`, { totalMs, phases: timings });
  } else {
    for (const phase of PHASES) {
      await phase.fn(ctx);
    }
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
