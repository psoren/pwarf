import type { SimContext } from "../sim-context.js";
import {
  MIN_NEED,
  FOOD_DECAY_PER_TICK,
  DRINK_DECAY_PER_TICK,
  SLEEP_DECAY_PER_TICK,
  SOCIAL_DECAY_PER_TICK,
  PURPOSE_DECAY_PER_TICK,
  BEAUTY_DECAY_PER_TICK,
} from "@pwarf/shared";

/**
 * Needs Decay Phase
 *
 * Decrements each alive dwarf's need meters by fixed per-tick rates,
 * clamping to MIN_NEED (0). Marks mutated dwarves as dirty so the
 * flush phase persists changes to the database.
 */
export function needsDecay(ctx: SimContext): void {
  for (const dwarf of ctx.state.dwarves) {
    if (dwarf.status !== "alive") continue;

    dwarf.need_food = Math.max(MIN_NEED, dwarf.need_food - FOOD_DECAY_PER_TICK);
    dwarf.need_drink = Math.max(MIN_NEED, dwarf.need_drink - DRINK_DECAY_PER_TICK);
    dwarf.need_sleep = Math.max(MIN_NEED, dwarf.need_sleep - SLEEP_DECAY_PER_TICK);
    dwarf.need_social = Math.max(MIN_NEED, dwarf.need_social - SOCIAL_DECAY_PER_TICK);
    dwarf.need_purpose = Math.max(MIN_NEED, dwarf.need_purpose - PURPOSE_DECAY_PER_TICK);
    dwarf.need_beauty = Math.max(MIN_NEED, dwarf.need_beauty - BEAUTY_DECAY_PER_TICK);

    ctx.state.dirtyDwarfIds.add(dwarf.id);
  }
}
