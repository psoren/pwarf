import { MIN_COOK_STOCK, WORK_COOK } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask } from "../task-helpers.js";

/**
 * Auto-Cook Phase
 *
 * When cooked food stock falls below MIN_COOK_STOCK and raw food (category=food,
 * material≠cooked) is available, create a single cook task at the raw food's
 * location if no pending/in-progress cook task already exists.
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

  // Find a raw food item (material is not 'cooked')
  const rawFood = groundFood.find(i => i.material !== 'cooked');
  if (!rawFood) return;
  if (rawFood.position_x === null || rawFood.position_y === null || rawFood.position_z === null) return;

  createTask(ctx, {
    task_type: 'cook',
    priority: 6,
    target_x: rawFood.position_x,
    target_y: rawFood.position_y,
    target_z: rawFood.position_z,
    work_required: WORK_COOK,
  });
}
