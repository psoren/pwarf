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
import { createTask } from "../task-helpers.js";

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

  // Eat/drink use infinite sources (beer fountain / meat roast) — no item lookup needed
  const workRequired = taskType === 'eat' ? WORK_EAT
    : taskType === 'drink' ? WORK_DRINK
    : WORK_SLEEP;

  createTask(state, ctx.civilizationId, {
    task_type: taskType,
    priority,
    target_x: dwarf.position_x,
    target_y: dwarf.position_y,
    target_z: dwarf.position_z,
    target_item_id: null,
    work_required: workRequired,
    assigned_dwarf_id: dwarf.id,
  });
}
