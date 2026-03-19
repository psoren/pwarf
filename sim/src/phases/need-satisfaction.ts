import {
  NEED_INTERRUPT_FOOD,
  NEED_INTERRUPT_DRINK,
  NEED_INTERRUPT_SLEEP,
  WORK_EAT,
  WORK_DRINK,
  WORK_SLEEP,
} from "@pwarf/shared";
import type { Dwarf, TaskType } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { createTask, findNearestItem, findNearestTileOfType } from "../task-helpers.js";

/**
 * Need Satisfaction Phase
 *
 * Checks each alive dwarf's needs. When a need drops below its interrupt
 * threshold, the dwarf drops their current task and creates an autonomous
 * task to satisfy the need (eat, drink, or sleep).
 *
 * Runs before job-claiming so that autonomous tasks get created and then
 * immediately picked up in the same tick.
 */
export async function needSatisfaction(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Check drink first (thirst kills fastest)
    if (dwarf.need_drink < NEED_INTERRUPT_DRINK) {
      maybeInterruptForNeed(dwarf, 'drink', ctx);
    }

    // Then food
    if (dwarf.need_food < NEED_INTERRUPT_FOOD) {
      maybeInterruptForNeed(dwarf, 'eat', ctx);
    }

    // Then sleep
    if (dwarf.need_sleep < NEED_INTERRUPT_SLEEP) {
      maybeInterruptForNeed(dwarf, 'sleep', ctx);
    }
  }
}

const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep']);

function maybeInterruptForNeed(dwarf: Dwarf, taskType: TaskType, ctx: SimContext): void {
  const { state } = ctx;

  // Don't interrupt if already doing an autonomous task
  if (dwarf.current_task_id) {
    const currentTask = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (currentTask && AUTONOMOUS_TASK_TYPES.has(currentTask.task_type)) {
      return;
    }
  }

  // Check if there's already a pending autonomous task for this dwarf of this type
  const existingTask = state.tasks.find(
    t => t.task_type === taskType
      && t.assigned_dwarf_id === dwarf.id
      && (t.status === 'pending' || t.status === 'claimed' || t.status === 'in_progress'),
  );
  if (existingTask) return;

  // Drop current task (return to pending)
  if (dwarf.current_task_id) {
    const currentTask = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed' && currentTask.status !== 'cancelled') {
      currentTask.status = 'pending';
      currentTask.assigned_dwarf_id = null;
      currentTask.work_progress = 0;
      state.dirtyTaskIds.add(currentTask.id);
    }
    dwarf.current_task_id = null;
    state.dirtyDwarfIds.add(dwarf.id);
  }

  // Calculate priority based on urgency
  const needValue = taskType === 'eat' ? dwarf.need_food
    : taskType === 'drink' ? dwarf.need_drink
    : dwarf.need_sleep;
  const priority = Math.min(10, Math.floor(10 * (1 - needValue / 100)));

  const workRequired = taskType === 'eat' ? WORK_EAT
    : taskType === 'drink' ? WORK_DRINK
    : WORK_SLEEP;

  // For eat/drink: try to find a tile source (mushroom garden / well) first,
  // then fall back to consumable items.
  let targetX = dwarf.position_x;
  let targetY = dwarf.position_y;
  let targetZ = dwarf.position_z;
  let targetItemId: string | null = null;

  if (taskType === 'eat') {
    const garden = findNearestTileOfType(
      'mushroom_garden', dwarf.position_x, dwarf.position_y, dwarf.position_z,
      state.fortressTileOverrides, ctx.fortressDeriver,
    );
    if (garden) {
      targetX = garden.x;
      targetY = garden.y;
      targetZ = garden.z;
    } else {
      const food = findNearestItem(state.items, 'food', dwarf.position_x, dwarf.position_y, dwarf.position_z);
      if (!food) return; // No food source available
      targetItemId = food.id;
    }
  } else if (taskType === 'drink') {
    const well = findNearestTileOfType(
      'well', dwarf.position_x, dwarf.position_y, dwarf.position_z,
      state.fortressTileOverrides, ctx.fortressDeriver,
    );
    if (well) {
      targetX = well.x;
      targetY = well.y;
      targetZ = well.z;
    } else {
      const drink = findNearestItem(state.items, 'drink', dwarf.position_x, dwarf.position_y, dwarf.position_z);
      if (!drink) return; // No drink source available
      targetItemId = drink.id;
    }
  }

  createTask(state, ctx.civilizationId, {
    task_type: taskType,
    priority,
    target_x: targetX,
    target_y: targetY,
    target_z: targetZ,
    target_item_id: targetItemId,
    work_required: workRequired,
    assigned_dwarf_id: dwarf.id,
  });
}
