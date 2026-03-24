import {
  GHOST_STRESS_PER_TICK,
  GHOST_HAUNTING_RADIUS,
  MAX_NEED,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";

/**
 * Haunting Phase
 *
 * Each tick:
 * 1. Register any newly dead dwarves as ghosts (if not already tracked)
 * 2. Apply stress to living dwarves within GHOST_HAUNTING_RADIUS of each ghost
 *
 * Ghosts are put to rest when an engrave_memorial task is completed nearby
 * (handled in task-completion.ts).
 *
 * Note: ghost state is session-only — dwarves who died in prior sessions
 * are not tracked as ghosts after a restart.
 */
export function haunting(ctx: SimContext): void {
  const { state } = ctx;

  // Ghost registration happens in killDwarf() — not here.
  // Dead dwarves from previous sessions are NOT ghosts.
  if (state.ghostDwarfIds.size === 0) return;

  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) return;

  // For each ghost, stress nearby living dwarves
  for (const ghostId of state.ghostDwarfIds) {
    const ghost = state.dwarves.find(d => d.id === ghostId);
    if (!ghost) continue;

    for (const dwarf of aliveDwarves) {
      // Dwarves in a strange mood are focused on their work — ghosts cannot reach them
      if (state.strangeMoodDwarfIds.has(dwarf.id)) continue;
      if (dwarf.position_z !== ghost.position_z) continue;
      const dist =
        Math.abs(dwarf.position_x - ghost.position_x) +
        Math.abs(dwarf.position_y - ghost.position_y);
      if (dist <= GHOST_HAUNTING_RADIUS) {
        dwarf.stress_level = Math.min(MAX_NEED, dwarf.stress_level + GHOST_STRESS_PER_TICK);
        state.dirtyDwarfIds.add(dwarf.id);
      }
    }
  }
}

/**
 * Puts a ghost to rest when a memorial is engraved nearby.
 * Selects the nearest ghost to the engraved tile and removes it from ghostDwarfIds.
 * Fires a discovery event describing the spirit being put to rest.
 */
export function putGhostToRest(
  tileX: number,
  tileY: number,
  engraverName: string,
  ctx: SimContext,
): void {
  const { state, rng, year, civilizationId } = ctx;

  if (state.ghostDwarfIds.size === 0) return;

  // Find the nearest ghost to the memorial tile
  let nearestGhostId: string | null = null;
  let nearestDist = Infinity;

  for (const ghostId of state.ghostDwarfIds) {
    const ghost = state.dwarves.find(d => d.id === ghostId);
    if (!ghost) {
      // Ghost's dwarf data is gone — just use the first one we find
      nearestGhostId = ghostId;
      break;
    }
    const dist =
      Math.abs(ghost.position_x - tileX) +
      Math.abs(ghost.position_y - tileY);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestGhostId = ghostId;
    }
  }

  if (!nearestGhostId) return;

  state.ghostDwarfIds.delete(nearestGhostId);

  const ghost = state.dwarves.find(d => d.id === nearestGhostId);
  const ghostName = ghost ? dwarfName(ghost) : 'the fallen dwarf';

  state.pendingEvents.push({
    id: rng.uuid(),
    world_id: '',
    year,
    category: 'discovery',
    civilization_id: civilizationId,
    ruin_id: null,
    dwarf_id: null,
    item_id: null,
    faction_id: null,
    monster_id: null,
    description: `${engraverName} has engraved a memorial for ${ghostName}. The spirit is put to rest.`,
    event_data: { type: 'ghost_laid_to_rest', ghost_dwarf_id: nearestGhostId },
    created_at: new Date().toISOString(),
  });
}
