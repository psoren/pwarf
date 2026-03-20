import {
  MAX_NEED,
  MIN_NEED,
  NEUROTICISM_STRESS_MULTIPLIER,
  AGREEABLENESS_RECOVERY_BONUS,
} from "@pwarf/shared";
import type { Dwarf } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Stress Update Phase
 *
 * Recalculates each dwarf's stress level based on unmet needs.
 * Low needs increase stress. Comfortable dwarves slowly recover.
 *
 * Personality traits modulate the effect:
 * - trait_neuroticism amplifies stress gains (0=stable, 0.5=average, 1=neurotic)
 * - trait_agreeableness adds passive stress recovery when all needs are comfortable
 */
export async function stressUpdate(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    const needValues = [
      dwarf.need_food,
      dwarf.need_drink,
      dwarf.need_sleep,
      dwarf.need_social,
      dwarf.need_purpose,
      dwarf.need_beauty,
    ];

    const delta = calcStressDelta(dwarf, needValues);

    if (delta !== 0) {
      dwarf.stress_level = Math.max(MIN_NEED, Math.min(MAX_NEED, dwarf.stress_level + delta));
      state.dirtyDwarfIds.add(dwarf.id);
    }
  }
}

/**
 * Calculates the stress delta for one tick given the dwarf's current needs
 * and personality traits. Exported for unit testing.
 *
 * @param dwarf - only trait_neuroticism and trait_agreeableness are used
 * @param needValues - [food, drink, sleep, social, purpose, beauty]
 * @returns stress delta (positive = more stress, negative = recovery)
 */
export function calcStressDelta(
  dwarf: Pick<Dwarf, 'trait_neuroticism' | 'trait_agreeableness'>,
  needValues: number[],
): number {
  let gainDelta = 0;

  // Each critically low need adds stress
  for (const needValue of needValues) {
    if (needValue < 20) {
      gainDelta += (20 - needValue) * 0.02; // max +0.4/tick per need
    }
    if (needValue <= MIN_NEED) {
      gainDelta += 0.5; // additional penalty for total deprivation
    }
  }

  // Apply neuroticism modifier to stress gains
  // trait_neuroticism: 0.0=very stable, 0.5=average (no effect), 1.0=very neurotic
  // Clamp modifier to [0.1, ∞) to guard against out-of-range trait values.
  if (gainDelta > 0 && dwarf.trait_neuroticism !== null) {
    gainDelta *= Math.max(0.1, 1 + (dwarf.trait_neuroticism - 0.5) * NEUROTICISM_STRESS_MULTIPLIER);
  }

  let recoveryDelta = 0;

  // Slow recovery when all needs are comfortable (expanded from 3 to all 6 needs)
  if (needValues.every(n => n > 50)) {
    recoveryDelta -= 0.1;

    // Agreeable dwarves recover additional stress per tick (clamp to 0..1 range)
    if (dwarf.trait_agreeableness !== null) {
      recoveryDelta -= Math.max(0, dwarf.trait_agreeableness) * AGREEABLENESS_RECOVERY_BONUS;
    }
  }

  return gainDelta + recoveryDelta;
}
