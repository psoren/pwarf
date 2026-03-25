import { WORKSHOP_INGREDIENT_RADIUS } from "@pwarf/shared";
import type { Item, Structure } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";

/** Maps crafting task types to their required workshop tile/structure type. */
export const TASK_WORKSHOP_MAP: Record<string, string> = {
  brew:  'still',
  cook:  'kitchen',
  smith: 'forge',
};

/**
 * Find the first available (unoccupied, complete) workshop of the given type
 * belonging to the given civilization.
 */
export function findAvailableWorkshop(
  state: CachedState,
  workshopType: string,
  civId: string,
): Structure | null {
  return state.structures.find(
    s =>
      s.type === workshopType &&
      s.civilization_id === civId &&
      s.completion_pct === 100 &&
      s.occupied_by_dwarf_id === null,
  ) ?? null;
}

/**
 * Find items within WORKSHOP_INGREDIENT_RADIUS Manhattan distance of a workshop
 * position (x, y, z), on the ground (not held), matching category and optional material.
 */
export function findItemsNearWorkshop(
  items: Item[],
  x: number,
  y: number,
  z: number,
  category: string,
  material?: string,
): Item[] {
  return items.filter(i => {
    if (i.category !== category) return false;
    if (material !== undefined && i.material !== material) return false;
    if (i.held_by_dwarf_id !== null) return false;
    if (i.position_x === null || i.position_y === null || i.position_z === null) return false;
    if (i.position_z !== z) return false;
    const dist = Math.abs(i.position_x - x) + Math.abs(i.position_y - y);
    return dist <= WORKSHOP_INGREDIENT_RADIUS;
  });
}
