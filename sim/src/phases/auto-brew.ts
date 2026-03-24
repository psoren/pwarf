import { MIN_DRINK_STOCK, WORK_BREW } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask } from "../task-helpers.js";

/**
 * Auto-Brew Phase
 *
 * When drink stocks fall below MIN_DRINK_STOCK and raw plant materials are
 * available, automatically creates a brew task so a brewer will produce ale.
 * This prevents dwarves dying of thirst once starting supplies run out.
 *
 * Only one pending brew task is created at a time to avoid flooding the queue.
 */
export async function autoBrew(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  // Count available drinks (not held by any dwarf)
  const drinkCount = state.items.filter(
    i => i.category === 'drink' && i.held_by_dwarf_id === null,
  ).length;

  if (drinkCount >= MIN_DRINK_STOCK) return;

  // Check if a brew task already exists (pending or in-progress)
  const brewPending = state.tasks.some(
    t => t.task_type === 'brew' &&
      (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress'),
  );
  if (brewPending) return;

  // Find a plant raw_material item not held by any dwarf
  const plant = state.items.find(
    i => i.category === 'raw_material' && i.material === 'plant' &&
      i.held_by_dwarf_id === null &&
      i.position_x !== null && i.position_y !== null && i.position_z !== null,
  );
  if (!plant) return;

  createTask(ctx, {
    task_type: 'brew',
    priority: 6,
    target_x: plant.position_x!,
    target_y: plant.position_y!,
    target_z: plant.position_z!,
    work_required: WORK_BREW,
  });
}
