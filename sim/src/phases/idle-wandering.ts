import { WORK_WANDER, WANDER_RADIUS, FORTRESS_SIZE } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask, isDwarfIdle } from "../task-helpers.js";
import { isWalkable } from "../pathfinding.js";
import { buildTileLookup } from "../tile-lookup.js";

/**
 * Idle Wandering Phase
 *
 * Gives idle dwarves a wander task so they move around the fortress
 * instead of standing still. Picks a random walkable tile within
 * WANDER_RADIUS of the dwarf's current position.
 */
export async function idleWandering(ctx: SimContext): Promise<void> {
  const { state } = ctx;
  const getTile = buildTileLookup(ctx);

  for (const dwarf of state.dwarves) {
    if (!isDwarfIdle(dwarf)) continue;

    // Don't create a wander task if one already exists for this dwarf
    const hasWander = state.tasks.some(
      t => t.task_type === 'wander'
        && t.assigned_dwarf_id === dwarf.id
        && (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress'),
    );
    if (hasWander) continue;

    // Pick a random offset within wander radius
    const dx = ctx.rng.int(-WANDER_RADIUS, WANDER_RADIUS);
    const dy = ctx.rng.int(-WANDER_RADIUS, WANDER_RADIUS);

    const targetX = Math.max(0, Math.min(FORTRESS_SIZE - 1, dwarf.position_x + dx));
    const targetY = Math.max(0, Math.min(FORTRESS_SIZE - 1, dwarf.position_y + dy));

    // Skip if it's the same spot
    if (targetX === dwarf.position_x && targetY === dwarf.position_y) continue;

    // Only pick walkable targets so BFS can actually path to them
    const targetTile = getTile(targetX, targetY, dwarf.position_z);
    if (!isWalkable(targetTile)) continue;

    createTask(ctx, {
      task_type: 'wander',
      priority: 1, // Lowest priority — any real task should take precedence
      target_x: targetX,
      target_y: targetY,
      target_z: dwarf.position_z,
      work_required: WORK_WANDER,
      assigned_dwarf_id: dwarf.id,
    });
  }
}
