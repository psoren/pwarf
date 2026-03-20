import { WORK_HAUL, STOCKPILE_TILE_CAPACITY } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { getCarriedItems } from "../inventory.js";
import { isDwarfIdle } from "../task-helpers.js";
import { createTask } from "../task-helpers.js";
import { manhattanDistance } from "../pathfinding.js";

/**
 * Haul Assignment Phase
 *
 * For each idle dwarf carrying items, find the nearest stockpile tile
 * with available capacity and create a haul task.
 */
export async function haulAssignment(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  if (state.stockpileTiles.size === 0) return;

  for (const dwarf of state.dwarves) {
    if (!isDwarfIdle(dwarf)) continue;

    const carried = getCarriedItems(dwarf.id, state.items);
    if (carried.length === 0) continue;

    // Find the nearest stockpile tile with capacity
    const target = findNearestOpenStockpile(ctx, dwarf.position_x, dwarf.position_y, dwarf.position_z);
    if (!target) continue;

    // Create a haul task for the first carried item
    const item = carried[0];
    createTask(ctx, {
      task_type: 'haul',
      priority: 4,
      target_x: target.x,
      target_y: target.y,
      target_z: target.z,
      target_item_id: item.id,
      work_required: WORK_HAUL,
    });
  }
}

/** Find the nearest stockpile tile that has room for more items. */
function findNearestOpenStockpile(
  ctx: SimContext,
  fromX: number,
  fromY: number,
  fromZ: number,
): { x: number; y: number; z: number } | null {
  const { state } = ctx;

  // Count items at each stockpile tile (items on the ground + pending haul tasks targeting it)
  const tileItemCounts = new Map<string, number>();

  for (const item of state.items) {
    if (item.held_by_dwarf_id !== null) continue;
    if (item.position_x === null || item.position_y === null || item.position_z === null) continue;
    const key = `${item.position_x},${item.position_y},${item.position_z}`;
    if (state.stockpileTiles.has(key)) {
      tileItemCounts.set(key, (tileItemCounts.get(key) ?? 0) + 1);
    }
  }

  // Also count pending haul tasks targeting each tile
  for (const task of state.tasks) {
    if (task.task_type !== 'haul') continue;
    if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed') continue;
    if (task.target_x === null || task.target_y === null || task.target_z === null) continue;
    const key = `${task.target_x},${task.target_y},${task.target_z}`;
    if (state.stockpileTiles.has(key)) {
      tileItemCounts.set(key, (tileItemCounts.get(key) ?? 0) + 1);
    }
  }

  let best: { x: number; y: number; z: number } | null = null;
  let bestDist = Infinity;

  for (const [key, tile] of state.stockpileTiles) {
    const count = tileItemCounts.get(key) ?? 0;
    if (count >= STOCKPILE_TILE_CAPACITY) continue;

    const dist = manhattanDistance(
      { x: fromX, y: fromY, z: fromZ },
      { x: tile.x, y: tile.y, z: tile.z },
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = { x: tile.x, y: tile.y, z: tile.z };
    }
  }

  return best;
}
