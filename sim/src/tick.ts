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

/** Run all sim phases for one tick in deterministic order. */
export async function runTick(ctx: SimContext): Promise<void> {
  await needsDecay(ctx);
  await taskExecution(ctx);
  await needSatisfaction(ctx);
  await stressUpdate(ctx);
  await tantrumCheck(ctx);
  await tantrumActions(ctx);
  await monsterSpawning(ctx);
  await monsterPathfinding(ctx);
  await combatResolution(ctx);
  await haulAssignment(ctx);
  taskRecovery(ctx);
  await autoCookPhase(ctx);
  await autoBrew(ctx);
  await autoForage(ctx);
  await jobClaiming(ctx);
  await eventFiring(ctx);
  await thoughtGeneration(ctx);
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
