import { WORK_HAUL, STOCKPILE_TILE_CAPACITY } from "@pwarf/shared";
import type { ItemCategory } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { getCarriedItems } from "../inventory.js";
import { isDwarfIdle } from "../task-helpers.js";
import { createTask } from "../task-helpers.js";
import { manhattanDistance } from "../pathfinding.js";

/**
 * Haul Assignment Phase
 *
 * 1. For each idle dwarf carrying items, create a haul task to the best stockpile.
 * 2. For ground items not on a stockpile, assign idle (non-carrying) dwarves to
 *    pick them up and haul them. The task execution phase handles the two-step
 *    movement: walk to item → pick up → walk to stockpile → drop.
 */
export async function haulAssignment(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  if (state.stockpileTiles.size === 0) return;

  // Track which items already have a pending/active haul task
  const itemsWithHaulTask = new Set<string>();
  for (const task of state.tasks) {
    if (task.task_type === 'haul' && task.target_item_id
      && task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'failed') {
      itemsWithHaulTask.add(task.target_item_id);
    }
  }

  // Phase 1: dwarves already carrying items → create haul tasks
  for (const dwarf of state.dwarves) {
    if (!isDwarfIdle(dwarf)) continue;

    const carried = getCarriedItems(dwarf.id, state.items);
    if (carried.length === 0) continue;

    const item = carried[0];
    if (itemsWithHaulTask.has(item.id)) continue;

    const target = findBestStockpile(ctx, dwarf.position_x, dwarf.position_y, dwarf.position_z, item.category);
    if (!target) continue;

    createTask(ctx, {
      task_type: 'haul',
      priority: 4,
      target_x: target.x,
      target_y: target.y,
      target_z: target.z,
      target_item_id: item.id,
      work_required: WORK_HAUL,
    });
    itemsWithHaulTask.add(item.id);
  }

  // Phase 2: ground items not on stockpiles → create haul tasks for idle dwarves to fetch
  for (const item of state.items) {
    if (item.held_by_dwarf_id !== null) continue;
    if (item.position_x === null || item.position_y === null || item.position_z === null) continue;
    if (item.located_in_civ_id !== ctx.civilizationId) continue;
    if (itemsWithHaulTask.has(item.id)) continue;

    // Skip items already sitting on a stockpile tile
    const itemKey = `${item.position_x},${item.position_y},${item.position_z}`;
    if (state.stockpileTiles.has(itemKey)) continue;

    const target = findBestStockpile(ctx, item.position_x, item.position_y, item.position_z, item.category);
    if (!target) continue;

    createTask(ctx, {
      task_type: 'haul',
      priority: 4,
      target_x: target.x,
      target_y: target.y,
      target_z: target.z,
      target_item_id: item.id,
      work_required: WORK_HAUL,
    });
    itemsWithHaulTask.add(item.id);
  }
}

/**
 * Find the best stockpile tile for an item.
 *
 * Selection order:
 * 1. Tiles that accept the item's category (or accept all categories)
 * 2. Among accepted tiles, prefer highest `priority`
 * 3. Among equal-priority tiles, prefer nearest (Manhattan distance)
 */
export function findBestStockpile(
  ctx: SimContext,
  fromX: number,
  fromY: number,
  fromZ: number,
  itemCategory: ItemCategory,
): { x: number; y: number; z: number } | null {
  const { state } = ctx;

  // Count items at each stockpile tile (on-ground + pending haul tasks)
  const tileItemCounts = new Map<string, number>();

  for (const item of state.items) {
    if (item.held_by_dwarf_id !== null) continue;
    if (item.position_x === null || item.position_y === null || item.position_z === null) continue;
    const key = `${item.position_x},${item.position_y},${item.position_z}`;
    if (state.stockpileTiles.has(key)) {
      tileItemCounts.set(key, (tileItemCounts.get(key) ?? 0) + 1);
    }
  }

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
  let bestPriority = -Infinity;
  let bestDist = Infinity;

  for (const [key, tile] of state.stockpileTiles) {
    // Skip if at capacity
    const count = tileItemCounts.get(key) ?? 0;
    if (count >= STOCKPILE_TILE_CAPACITY) continue;

    // Skip if this stockpile doesn't accept the item's category
    if (tile.accepts_categories !== null && !tile.accepts_categories.includes(itemCategory)) continue;

    const dist = manhattanDistance(
      { x: fromX, y: fromY, z: fromZ },
      { x: tile.x, y: tile.y, z: tile.z },
    );
    const tilePriority = tile.priority ?? 0;

    // Prefer higher priority; break ties by distance
    if (tilePriority > bestPriority || (tilePriority === bestPriority && dist < bestDist)) {
      bestPriority = tilePriority;
      bestDist = dist;
      best = { x: tile.x, y: tile.y, z: tile.z };
    }
  }

  return best;
}
