import { MAX_NEED, MIN_NEED } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Stress Update Phase
 *
 * Recalculates each dwarf's stress level based on unmet needs.
 * Low food/drink/sleep increases stress. Comfortable dwarves slowly recover.
 */
export async function stressUpdate(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    let stressDelta = 0;

    // Each critically low need adds stress
    const needs = [
      dwarf.need_food,
      dwarf.need_drink,
      dwarf.need_sleep,
      dwarf.need_social,
      dwarf.need_purpose,
      dwarf.need_beauty,
    ];

    for (const needValue of needs) {
      if (needValue < 20) {
        stressDelta += (20 - needValue) * 0.02; // max +0.4/tick per need
      }
      if (needValue <= MIN_NEED) {
        stressDelta += 0.5; // additional penalty for total deprivation
      }
    }

    // Slow recovery when physical needs are comfortable
    if (dwarf.need_food > 50 && dwarf.need_drink > 50 && dwarf.need_sleep > 50) {
      stressDelta -= 0.1;
    }

    if (stressDelta !== 0) {
      dwarf.stress_level = Math.max(MIN_NEED, Math.min(MAX_NEED, dwarf.stress_level + stressDelta));
      state.dirtyDwarfIds.add(dwarf.id);
    }
  }
}
