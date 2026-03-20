import { GHOST_STRESS_PER_TICK, GHOST_HAUNTING_RADIUS } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Haunting Phase
 *
 * Each tick, dwarves who died without a memorial (tracked in ghostDwarfIds)
 * apply passive stress to nearby living dwarves. The player can put ghosts
 * to rest by engraving a memorial slab near the ghost's death location.
 */
export function haunting(ctx: SimContext): void {
  const { state } = ctx;

  if (state.ghostDwarfIds.size === 0) return;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) return;

  for (const ghostId of state.ghostDwarfIds) {
    const pos = state.ghostPositions.get(ghostId);
    if (!pos) continue;

    for (const dwarf of aliveDwarves) {
      // Dwarves in a strange mood are focused on their work — ghosts cannot reach them
      if (state.strangeMoodDwarfIds.has(dwarf.id)) continue;
      if (dwarf.position_z !== pos.z) continue;
      const dist =
        Math.abs(dwarf.position_x - pos.x) +
        Math.abs(dwarf.position_y - pos.y);
      if (dist <= GHOST_HAUNTING_RADIUS) {
        dwarf.stress_level = Math.min(100, dwarf.stress_level + GHOST_STRESS_PER_TICK);
        state.dirtyDwarfIds.add(dwarf.id);
      }
    }
  }
}
