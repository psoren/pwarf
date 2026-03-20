import {
  NEED_INTERRUPT_FOOD,
  NEED_INTERRUPT_DRINK,
  NEED_INTERRUPT_SLEEP,
  WORK_EAT,
  WORK_DRINK,
  WORK_SLEEP,
  MAX_NEED,
  SOCIAL_RESTORE_PER_NEARBY_DWARF,
  SOCIAL_PROXIMITY_RADIUS,
  SOCIAL_PROXIMITY_MAX_DWARVES,
} from "@pwarf/shared";
import type { Dwarf, TaskType, Structure } from "@pwarf/shared";
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

    // Social: restore need based on proximity to other alive dwarves
    restoreSocialNeed(dwarf, state.dwarves);
  }
}

const AUTONOMOUS_TASK_TYPES: ReadonlySet<string> = new Set(['eat', 'drink', 'sleep']);

function findNearestBed(
  structures: Structure[],
  fromX: number,
  fromY: number,
  fromZ: number,
): Structure | null {
  let nearest: Structure | null = null;
  let nearestDist = Infinity;

  for (const s of structures) {
    if (s.type !== 'bed') continue;
    if (s.completion_pct < 100) continue;
    if (s.occupied_by_dwarf_id !== null) continue;
    if (s.position_x === null || s.position_y === null || s.position_z === null) continue;

    const dist = Math.abs(s.position_x - fromX) + Math.abs(s.position_y - fromY) + Math.abs(s.position_z - fromZ) * 10;
    if (dist < nearestDist) {
      nearest = s;
      nearestDist = dist;
    }
  }

  return nearest;
}

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

  // Drop current task
  if (dwarf.current_task_id) {
    const currentTask = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed' && currentTask.status !== 'cancelled') {
      if (currentTask.task_type === 'wander') {
        // Wander tasks must be completed, not reset to pending — resetting with
        // assigned_dwarf_id=null creates an orphaned autonomous task no one can ever claim.
        currentTask.status = 'completed';
        currentTask.completed_at = new Date().toISOString();
      } else {
        currentTask.status = 'pending';
        currentTask.assigned_dwarf_id = null;
        currentTask.work_progress = 0;
      }
      state.dirtyTaskIds.add(currentTask.id);

      // Release bed if dropping a sleep task
      if (currentTask.task_type === 'sleep' && currentTask.target_item_id) {
        const bed = state.structures.find(s => s.id === currentTask.target_item_id);
        if (bed) {
          bed.occupied_by_dwarf_id = null;
          state.dirtyStructureIds.add(bed.id);
        }
      }
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

  // For sleep: try to find an available bed
  let targetX = dwarf.position_x;
  let targetY = dwarf.position_y;
  let targetZ = dwarf.position_z;
  let targetItemId: string | null = null;

  if (taskType === 'sleep') {
    const bed = findNearestBed(state.structures, dwarf.position_x, dwarf.position_y, dwarf.position_z);
    if (bed && bed.position_x !== null && bed.position_y !== null && bed.position_z !== null) {
      targetX = bed.position_x;
      targetY = bed.position_y;
      targetZ = bed.position_z;
      targetItemId = bed.id;
      bed.occupied_by_dwarf_id = dwarf.id;
      state.dirtyStructureIds.add(bed.id);
    }
  }

  createTask(ctx, {
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

/**
 * Restores social need based on how many other alive dwarves are nearby.
 * Counts up to SOCIAL_PROXIMITY_MAX_DWARVES for diminishing returns.
 * Exported for unit testing.
 */
export function restoreSocialNeed(dwarf: Dwarf, allDwarves: Dwarf[]): void {
  let nearbyCount = 0;
  for (const other of allDwarves) {
    if (other.id === dwarf.id) continue;
    if (other.status !== 'alive') continue;
    if (other.position_z !== dwarf.position_z) continue;
    const dist = Math.abs(other.position_x - dwarf.position_x) + Math.abs(other.position_y - dwarf.position_y);
    if (dist <= SOCIAL_PROXIMITY_RADIUS) {
      nearbyCount++;
    }
  }

  if (nearbyCount === 0) return;

  const effectiveCount = Math.min(nearbyCount, SOCIAL_PROXIMITY_MAX_DWARVES);
  const restore = effectiveCount * SOCIAL_RESTORE_PER_NEARBY_DWARF;
  dwarf.need_social = Math.min(MAX_NEED, dwarf.need_social + restore);
}
