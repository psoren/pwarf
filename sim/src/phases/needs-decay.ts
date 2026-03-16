import type { SimContext } from "../sim-context.js";
import {
  MIN_NEED,
  DECAY_FOOD,
  DECAY_DRINK,
  DECAY_SLEEP,
  DECAY_SOCIAL,
  DECAY_PURPOSE,
  DECAY_BEAUTY,
} from "@pwarf/shared";

/**
 * Needs Decay Phase
 *
 * Decrements each living dwarf's need meters by a small amount every
 * simulation step. Needs that reach zero will begin generating stress
 * in the stress-update phase.
 */
export async function needsDecay(ctx: SimContext): Promise<void> {
  for (const dwarf of ctx.state.dwarves) {
    if (dwarf.status !== "alive") continue;

    dwarf.need_food = Math.max(MIN_NEED, dwarf.need_food - DECAY_FOOD);
    dwarf.need_drink = Math.max(MIN_NEED, dwarf.need_drink - DECAY_DRINK);
    dwarf.need_sleep = Math.max(MIN_NEED, dwarf.need_sleep - DECAY_SLEEP);
    dwarf.need_social = Math.max(MIN_NEED, dwarf.need_social - DECAY_SOCIAL);
    dwarf.need_purpose = Math.max(MIN_NEED, dwarf.need_purpose - DECAY_PURPOSE);
    dwarf.need_beauty = Math.max(MIN_NEED, dwarf.need_beauty - DECAY_BEAUTY);

    ctx.state.dirtyDwarfIds.add(dwarf.id);
  }
}
