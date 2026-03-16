import type { SimContext } from "../sim-context.js";

/**
 * Event Firing Phase
 *
 * Collects all notable events that occurred during this tick (births, deaths,
 * completed constructions, artifact creations, sieges, etc.) and writes them
 * to the world_events table in Supabase for the UI and history log.
 */
export async function eventFiring(_ctx: SimContext): Promise<void> {
  // stub
}
