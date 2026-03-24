import type { Item } from "@pwarf/shared";
import { BUILDING_COSTS } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";

/**
 * Checks whether the fortress has enough resources to pay for a build task.
 */
export function hasResources(taskType: string, items: readonly Item[], civId: string): boolean {
  const costs = BUILDING_COSTS[taskType];
  if (!costs) return true; // no cost defined = free

  for (const cost of costs) {
    const available = countAvailableItems(items, civId, cost.category, cost.material);
    if (available < cost.count) return false;
  }
  return true;
}

/**
 * Consumes resources for a build task. Returns true if successful, false if
 * insufficient resources (no items are consumed in that case).
 */
export function consumeResources(taskType: string, ctx: SimContext): boolean {
  const costs = BUILDING_COSTS[taskType];
  if (!costs) return true;

  const { state } = ctx;

  // First pass: verify all costs can be met
  if (!hasResources(taskType, state.items, ctx.civilizationId)) return false;

  // Second pass: consume items
  for (const cost of costs) {
    let remaining = cost.count;
    for (let i = state.items.length - 1; i >= 0 && remaining > 0; i--) {
      const item = state.items[i];
      if (
        item.category === cost.category &&
        item.material === cost.material &&
        item.located_in_civ_id === ctx.civilizationId &&
        item.held_by_dwarf_id === null
      ) {
        state.items.splice(i, 1);
        remaining--;
      }
    }
  }

  return true;
}

/**
 * Counts items in the fortress matching the given category and material
 * that are not held by a dwarf (i.e., on the ground or in stockpiles).
 * Exported for use in the app to show resource availability.
 */
export function countAvailableItems(
  items: readonly Item[],
  civId: string,
  category: string,
  material: string,
): number {
  let count = 0;
  for (const item of items) {
    if (
      item.category === category &&
      item.material === material &&
      item.located_in_civ_id === civId &&
      item.held_by_dwarf_id === null
    ) {
      count++;
    }
  }
  return count;
}
