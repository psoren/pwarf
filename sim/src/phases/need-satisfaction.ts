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
import type { Dwarf, Item, TaskType, Structure } from "@pwarf/shared";
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

/**
 * Finds the nearest accessible food item for a dwarf.
 * Accessible means: on the ground (position set, not held) or already held by this dwarf.
 * Exported for unit testing.
 */
export function findNearestFood(
  items: Item[],
  dwarfId: string,
  fromX: number,
  fromY: number,
  fromZ: number,
): Item | null {
  let nearest: Item | null = null;
  let nearestDist = Infinity;

  for (const item of items) {
    if (item.category !== 'food') continue;

    const heldByDwarf = item.held_by_dwarf_id === dwarfId;
    const onGround = item.held_by_dwarf_id === null
      && item.position_x !== null
      && item.position_y !== null
      && item.position_z !== null;

    if (!heldByDwarf && !onGround) continue;

    const itemX = heldByDwarf ? fromX : item.position_x!;
    const itemY = heldByDwarf ? fromY : item.position_y!;
    const itemZ = heldByDwarf ? fromZ : item.position_z!;

    const dist = Math.abs(itemX - fromX) + Math.abs(itemY - fromY) + Math.abs(itemZ - fromZ) * 10;
    if (dist < nearestDist) {
      nearest = item;
      nearestDist = dist;
    }
  }

  return nearest;
}

/**
 * Finds the nearest water source for a dwarf.
 * Checks for a well structure first (infinite supply), then a drink item on the ground.
 * Returns { type, x, y, z, itemId } — itemId is null for wells.
 * Exported for unit testing.
 */
export function findNearestWaterSource(
  structures: Structure[],
  items: Item[],
  dwarfId: string,
  fromX: number,
  fromY: number,
  fromZ: number,
): { x: number; y: number; z: number; itemId: string | null } | null {
  // Prefer well structures (infinite supply)
  let nearest: { x: number; y: number; z: number; itemId: string | null } | null = null;
  let nearestDist = Infinity;

  for (const s of structures) {
    if (s.type !== 'well') continue;
    if (s.completion_pct < 100) continue;
    if (s.position_x === null || s.position_y === null || s.position_z === null) continue;

    const dist = Math.abs(s.position_x - fromX) + Math.abs(s.position_y - fromY) + Math.abs(s.position_z - fromZ) * 10;
    if (dist < nearestDist) {
      nearest = { x: s.position_x, y: s.position_y, z: s.position_z, itemId: null };
      nearestDist = dist;
    }
  }

  // Also check drink items (held by dwarf or on ground)
  for (const item of items) {
    if (item.category !== 'drink') continue;

    const heldByDwarf = item.held_by_dwarf_id === dwarfId;
    const onGround = item.held_by_dwarf_id === null
      && item.position_x !== null
      && item.position_y !== null
      && item.position_z !== null;

    if (!heldByDwarf && !onGround) continue;

    const itemX = heldByDwarf ? fromX : item.position_x!;
    const itemY = heldByDwarf ? fromY : item.position_y!;
    const itemZ = heldByDwarf ? fromZ : item.position_z!;

    const dist = Math.abs(itemX - fromX) + Math.abs(itemY - fromY) + Math.abs(itemZ - fromZ) * 10;
    if (dist < nearestDist) {
      nearest = { x: itemX, y: itemY, z: itemZ, itemId: item.id };
      nearestDist = dist;
    }
  }

  return nearest;
}

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

  // Resolve target before dropping current task — if no source is available, abort early
  // so we don't interrupt productive work for a need that can't be satisfied yet.
  let targetX = dwarf.position_x;
  let targetY = dwarf.position_y;
  let targetZ = dwarf.position_z;
  let targetItemId: string | null = null;

  if (taskType === 'eat') {
    const food = findNearestFood(state.items, dwarf.id, dwarf.position_x, dwarf.position_y, dwarf.position_z);
    if (!food) return; // No food available — dwarf goes hungry
    targetItemId = food.id;
    targetX = food.held_by_dwarf_id === dwarf.id ? dwarf.position_x : (food.position_x ?? dwarf.position_x);
    targetY = food.held_by_dwarf_id === dwarf.id ? dwarf.position_y : (food.position_y ?? dwarf.position_y);
    targetZ = food.held_by_dwarf_id === dwarf.id ? dwarf.position_z : (food.position_z ?? dwarf.position_z);
  } else if (taskType === 'drink') {
    const water = findNearestWaterSource(state.structures, state.items, dwarf.id, dwarf.position_x, dwarf.position_y, dwarf.position_z);
    if (!water) return; // No water available — dwarf goes thirsty
    targetX = water.x;
    targetY = water.y;
    targetZ = water.z;
    targetItemId = water.itemId;
  } else if (taskType === 'sleep') {
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

  // Drop current task now that we know we can satisfy the need
  if (dwarf.current_task_id) {
    const currentTask = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (currentTask && currentTask.status !== 'completed' && currentTask.status !== 'failed' && currentTask.status !== 'cancelled') {
      currentTask.status = 'pending';
      currentTask.assigned_dwarf_id = null;
      currentTask.work_progress = 0;
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

  const workRequired = taskType === 'eat' ? WORK_EAT
    : taskType === 'drink' ? WORK_DRINK
    : WORK_SLEEP;

  const task = createTask(ctx, {
    task_type: taskType,
    priority,
    target_x: targetX,
    target_y: targetY,
    target_z: targetZ,
    target_item_id: targetItemId,
    work_required: workRequired,
    assigned_dwarf_id: dwarf.id,
  });

  // Immediately claim and assign so the dwarf can execute next tick.
  // This is critical for tantruming dwarves: jobClaiming skips them
  // (isDwarfIdle returns false), so without this the task stays pending
  // forever — creating a death spiral where the dwarf can never eat/sleep.
  task.status = 'claimed';
  dwarf.current_task_id = task.id;
  state.dirtyDwarfIds.add(dwarf.id);
  state.dirtyTaskIds.add(task.id);
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
