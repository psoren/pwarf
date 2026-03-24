import {
  MAX_NEED,
  BEAUTY_RESTORE_PASSIVE,
  BEAUTY_RESTORE_NEAR_STRUCTURE,
  BEAUTY_STRUCTURE_RADIUS,
  OPENNESS_BEAUTY_MULTIPLIER,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/** Structure types that provide beauty bonus */
const BEAUTY_STRUCTURES = new Set(['well', 'mushroom_garden', 'bed']);

/**
 * Beauty Restoration Phase
 *
 * Every tick, alive dwarves receive:
 * - A passive baseline restoration (always applies)
 * - A bonus if near a well, mushroom garden, or similar structure
 *
 * trait_openness scales the structure bonus: open dwarves appreciate beauty more.
 * Beauty decays slowly (0.03/tick) so even the passive rate provides
 * meaningful recovery for dwarves who aren't in a barren fortress.
 */
export async function beautyRestoration(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    let restore = BEAUTY_RESTORE_PASSIVE;

    // Check for nearby beauty-providing structures
    for (const structure of state.structures) {
      if (!BEAUTY_STRUCTURES.has(structure.type)) continue;
      if (structure.completion_pct < 100) continue;
      if (structure.position_x === null || structure.position_y === null || structure.position_z === null) continue;
      if (structure.position_z !== dwarf.position_z) continue;

      const dist = Math.abs(structure.position_x - dwarf.position_x)
        + Math.abs(structure.position_y - dwarf.position_y);

      if (dist <= BEAUTY_STRUCTURE_RADIUS) {
        // trait_openness: 0.5=average (no effect), 1.0=+50% bonus, 0.0=-50% bonus
        const opennessModifier = dwarf.trait_openness !== null
          ? 1 + (dwarf.trait_openness - 0.5) * OPENNESS_BEAUTY_MULTIPLIER
          : 1;
        restore += BEAUTY_RESTORE_NEAR_STRUCTURE * opennessModifier;
        break; // only one bonus per tick regardless of how many structures
      }
    }

    dwarf.need_beauty = Math.min(MAX_NEED, dwarf.need_beauty + restore);
    ctx.state.dirtyDwarfIds.add(dwarf.id);
  }
}
