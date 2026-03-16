import type { SimContext } from "../sim-context.js";

/**
 * Yearly Rollup Phase
 *
 * Runs once every STEPS_PER_YEAR steps. Handles long-cadence updates:
 * - Aging: increments dwarf ages, triggers old-age death checks
 * - Skill ups: awards skill level increases based on accumulated XP
 * - Immigration: new dwarves arrive based on fortress wealth/reputation
 * - Faction drift: updates relationships between civilizations
 * - Disease: rolls for plague/illness outbreaks
 * - Ruin decay: abandoned structures degrade over time
 */
export async function yearlyRollup(_ctx: SimContext): Promise<void> {
  // stub
}
