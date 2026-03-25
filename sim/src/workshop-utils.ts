import { WORKSHOP_INGREDIENT_RADIUS, TASK_WORKSHOP_MAP } from "@pwarf/shared";
import type { Item, Structure, Task } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";

export { TASK_WORKSHOP_MAP };

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

/**
 * Set workshop occupancy when a dwarf claims a crafting task.
 * Only applies to tasks whose task_type is in TASK_WORKSHOP_MAP
 * and whose target_item_id points to a workshop structure.
 */
export function setWorkshopOccupancy(task: Task, dwarfId: string, state: CachedState): void {
  if (!task.target_item_id) return;
  if (!(task.task_type in TASK_WORKSHOP_MAP)) return;
  const workshop = state.structures.find(s => s.id === task.target_item_id);
  if (workshop) {
    workshop.occupied_by_dwarf_id = dwarfId;
    state.dirtyStructureIds.add(workshop.id);
  }
}

/**
 * Release workshop occupancy when a task completes, fails, or is cancelled.
 */
export function releaseWorkshopOccupancy(task: Task, state: CachedState): void {
  if (!task.target_item_id) return;
  if (!(task.task_type in TASK_WORKSHOP_MAP)) return;
  const workshop = state.structures.find(s => s.id === task.target_item_id);
  if (workshop) {
    workshop.occupied_by_dwarf_id = null;
    state.dirtyStructureIds.add(workshop.id);
  }
}
