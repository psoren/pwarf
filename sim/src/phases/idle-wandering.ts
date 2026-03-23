import type { SimContext } from "../sim-context.js";

/**
 * Idle Wandering Phase
 *
 * Disabled — idle dwarves now stay put instead of wandering randomly.
 * Kept as a no-op so callers don't need to change.
 */
export async function idleWandering(_ctx: SimContext): Promise<void> {
  // Intentionally empty — dwarves stand still when idle.
}
