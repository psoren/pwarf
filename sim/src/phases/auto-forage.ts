import { MIN_FORAGE_FOOD_STOCK, WORK_FORAGE, FORAGEABLE_TILE_TYPES } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask } from "../task-helpers.js";

/**
 * Auto-Forage Phase
 *
 * When food stocks fall below MIN_FORAGE_FOOD_STOCK and forageable tiles
 * (grass, tree, bush) are present in the fortress tile overrides, automatically
 * creates a forage task so dwarves will gather wild food.
 *
 * Only one pending forage task is created at a time to avoid flooding the queue.
 * Foraging is a fallback survival mechanism for early fortresses before farming
 * comes online.
 */
export async function autoForage(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  // Count available food items (not held by any dwarf)
  const foodCount = state.items.filter(
    i => i.category === 'food' && i.held_by_dwarf_id === null,
  ).length;

  if (foodCount >= MIN_FORAGE_FOOD_STOCK) return;

  // Check if a forage task already exists (pending or in-progress)
  const foragePending = state.tasks.some(
    t => t.task_type === 'forage' &&
      (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress'),
  );
  if (foragePending) return;

  // Find a forageable tile from the overrides map
  let targetX: number | null = null;
  let targetY: number | null = null;
  let targetZ: number | null = null;

  for (const tile of state.fortressTileOverrides.values()) {
    if (FORAGEABLE_TILE_TYPES.has(tile.tile_type)) {
      targetX = tile.x;
      targetY = tile.y;
      targetZ = tile.z;
      break;
    }
  }

  if (targetX === null) return;

  createTask(ctx, {
    task_type: 'forage',
    priority: 7,
    target_x: targetX,
    target_y: targetY,
    target_z: targetZ,
    work_required: WORK_FORAGE,
  });
}
