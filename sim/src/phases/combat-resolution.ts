import type { SimContext } from "../sim-context.js";

/**
 * Combat Resolution Phase
 *
 * Detects tiles where a monster and a dwarf (or military squad) overlap.
 * Resolves combat using attack/defense stats, equipment, skills, and
 * randomness. Applies damage, generates wound/death events, and awards XP.
 */
export async function combatResolution(_ctx: SimContext): Promise<void> {
  // stub
}
