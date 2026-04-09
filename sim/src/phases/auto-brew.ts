import { MIN_DRINK_STOCK, WORK_BREW } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask } from "../task-helpers.js";
import { findAvailableWorkshop, findItemNearWorkshop } from "../workshop-utils.js";

/**
 * Auto-Brew Phase
 *
 * When drink stocks fall below MIN_DRINK_STOCK, finds an unoccupied still
 * with plant raw_material within ingredient radius, and creates a brew task
 * targeting the still. Without a still, no brewing happens.
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

  // Find an unoccupied still workshop
  const still = findAvailableWorkshop(ctx, 'still');
  if (!still || still.position_x === null || still.position_y === null || still.position_z === null) return;

  // Find plant raw_material within ingredient radius of the still
  const plant = findItemNearWorkshop(ctx, still.position_x, still.position_y, still.position_z, 'raw_material', 'plant');
  if (!plant) return;

  createTask(ctx, {
    task_type: 'brew',
    priority: 6,
    target_x: still.position_x,
    target_y: still.position_y,
    target_z: still.position_z,
    target_item_id: still.id, // Workshop occupancy link
    work_required: WORK_BREW,
  });
}
