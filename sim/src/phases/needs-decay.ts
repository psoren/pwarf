import type { SimContext } from "../sim-context.js";

/**
 * Needs Decay Phase
 *
 * Decrements each dwarf's need meters (hunger, thirst, sleep, social, etc.)
 * by a small amount every simulation step. Needs that reach zero will begin
 * generating stress in the stress-update phase.
 */
export async function needsDecay(_ctx: SimContext): Promise<void> {
  // stub
}
