import { WORKSHOP_INGREDIENT_RADIUS, TASK_WORKSHOP_MAP } from "@pwarf/shared";
import type { Item, ItemCategory, Structure } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import { manhattanDistance } from "./pathfinding.js";

/**
 * Find an unoccupied workshop of the given type.
 * Returns the nearest unoccupied workshop, or null if none available.
 */
export function findAvailableWorkshop(
  ctx: SimContext,
  workshopType: string,
  fromX?: number,
  fromY?: number,
  fromZ?: number,
): Structure | null {
  const { state } = ctx;
  let best: Structure | null = null;
  let bestDist = Infinity;

  for (const s of state.structures) {
    if (s.type !== workshopType) continue;
    if (s.completion_pct < 100) continue;
    if (s.occupied_by_dwarf_id !== null) continue;
    if (s.position_x === null || s.position_y === null || s.position_z === null) continue;

    if (fromX !== undefined && fromY !== undefined && fromZ !== undefined) {
      const dist = manhattanDistance(
        { x: fromX, y: fromY, z: fromZ },
        { x: s.position_x, y: s.position_y, z: s.position_z },
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    } else {
      return s; // No position preference — return first available
    }
  }

  return best;
}

/**
 * Find an item of the given category (and optional material) within
 * WORKSHOP_INGREDIENT_RADIUS of a position.
 */
export function findItemNearWorkshop(
  ctx: SimContext,
  workshopX: number,
  workshopY: number,
  workshopZ: number,
  category: ItemCategory,
  material?: string,
): Item | null {
  const { state } = ctx;
  let best: Item | null = null;
  let bestDist = Infinity;

  for (const item of state.items) {
    if (item.category !== category) continue;
    if (material && item.material !== material) continue;
    if (item.held_by_dwarf_id !== null) continue;
    if (item.position_x === null || item.position_y === null || item.position_z === null) continue;
    if (item.located_in_civ_id !== ctx.civilizationId) continue;

    const dist = manhattanDistance(
      { x: workshopX, y: workshopY, z: workshopZ },
      { x: item.position_x, y: item.position_y, z: item.position_z },
    );
    if (dist > WORKSHOP_INGREDIENT_RADIUS) continue;

    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }

  return best;
}

/**
 * Get the required workshop type for a crafting task, or null if no workshop needed.
 */
export function getRequiredWorkshopType(taskType: string): string | null {
  return TASK_WORKSHOP_MAP[taskType] ?? null;
}
