import {
  FOOD_DECAY_PER_TICK,
  DRINK_DECAY_PER_TICK,
  SLEEP_DECAY_PER_TICK,
  SOCIAL_DECAY_PER_TICK,
  PURPOSE_DECAY_PER_TICK,
  BEAUTY_DECAY_PER_TICK,
  EXTRAVERSION_SOCIAL_DECAY_MULTIPLIER,
  MIN_NEED,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Needs Decay Phase
 *
 * Decrements each living dwarf's need meters by fixed rates every
 * simulation step. Needs are clamped at MIN_NEED (0). Mutated dwarves
 * are marked dirty so they get flushed to the database.
 *
 * Personality traits modulate decay rates:
 * - trait_extraversion scales social need decay (extraverts crave contact more urgently)
 */
export async function needsDecay(ctx: SimContext): Promise<void> {
  for (const dwarf of ctx.state.dwarves) {
    if (dwarf.status !== "alive") continue;

    // trait_extraversion: 0.5=average (no effect), 1.0=extravert (+50% faster decay), 0.0=introvert (-50%)
    // Clamp to 0.1 minimum to guard against out-of-range trait values.
    const extraversionModifier = dwarf.trait_extraversion !== null
      ? Math.max(0.1, 1 + (dwarf.trait_extraversion - 0.5) * EXTRAVERSION_SOCIAL_DECAY_MULTIPLIER)
      : 1;

    dwarf.need_food = Math.max(MIN_NEED, dwarf.need_food - FOOD_DECAY_PER_TICK);
    dwarf.need_drink = Math.max(MIN_NEED, dwarf.need_drink - DRINK_DECAY_PER_TICK);
    dwarf.need_sleep = Math.max(MIN_NEED, dwarf.need_sleep - SLEEP_DECAY_PER_TICK);
    dwarf.need_social = Math.max(MIN_NEED, dwarf.need_social - SOCIAL_DECAY_PER_TICK * extraversionModifier);
    dwarf.need_purpose = Math.max(MIN_NEED, dwarf.need_purpose - PURPOSE_DECAY_PER_TICK);
    dwarf.need_beauty = Math.max(MIN_NEED, dwarf.need_beauty - BEAUTY_DECAY_PER_TICK);

    ctx.state.dirtyDwarfIds.add(dwarf.id);
  }
}
