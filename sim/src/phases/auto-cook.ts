import { MIN_COOK_STOCK, WORK_COOK } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask } from "../task-helpers.js";
import { findAvailableWorkshop, findItemsNearWorkshop } from "../workshop-utils.js";

/**
 * Auto-Cook Phase
 *
 * When cooked food stock falls below MIN_COOK_STOCK, a kitchen is available, and
 * raw food is within WORKSHOP_INGREDIENT_RADIUS of the kitchen, creates a cook task
 * targeting the kitchen position.
 *
 * No kitchen → no cooking. Only one pending cook task is created at a time.
 */
export async function autoCookPhase(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  // Count food items not held by dwarves
  const groundFood = state.items.filter(
    i => i.category === 'food' && i.held_by_dwarf_id === null,
  );

  if (groundFood.length >= MIN_COOK_STOCK) return;

  // Check for existing pending/in-progress cook task
  const hasCookTask = state.tasks.some(
    t =>
      t.task_type === 'cook' &&
      (t.status === 'pending' || t.status === 'in_progress'),
  );
  if (hasCookTask) return;

  // Find an unoccupied kitchen
  const kitchen = findAvailableWorkshop(state, 'kitchen', ctx.civilizationId);
  if (!kitchen) return;
  if (kitchen.position_x === null || kitchen.position_y === null || kitchen.position_z === null) return;

  // Find raw food near the kitchen
  const nearbyFood = findItemsNearWorkshop(
    state.items,
    kitchen.position_x,
    kitchen.position_y,
    kitchen.position_z,
    'food',
  ).filter(i => i.material !== 'cooked');
  if (nearbyFood.length === 0) return;

  createTask(ctx, {
    task_type: 'cook',
    priority: 6,
    target_x: kitchen.position_x,
    target_y: kitchen.position_y,
    target_z: kitchen.position_z,
    target_item_id: kitchen.id,
    work_required: WORK_COOK,
  });
}
