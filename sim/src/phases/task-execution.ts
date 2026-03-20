import {
  BASE_WORK_RATE,
  SLEEP_RESTORE_PER_TICK,
  MAX_NEED,
  HARDNESS_SOIL,
  HARDNESS_STONE,
  HARDNESS_IGNITE,
  HARDNESS_ORE,
  HARDNESS_GEM,
} from "@pwarf/shared";
import type { Dwarf, Task } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { getDwarfSkillLevel, getRequiredSkill } from "../task-helpers.js";
import { bfsNextStep } from "../pathfinding.js";
import { buildTileLookup } from "../tile-lookup.js";
import { handleDeprivationDeaths } from "./deprivation.js";
import { completeTask } from "./task-completion.js";

/** Task types where the dwarf stands adjacent to (not on) the target tile. */
const ADJACENT_TASK_TYPES: ReadonlySet<string> = new Set(['mine', 'build_wall']);

/**
 * Task Execution Phase
 *
 * For each dwarf with a current task:
 * 1. If not at the task site, move one step toward it.
 * 2. If at the task site, increment work progress.
 * 3. If work is complete, apply effects (tile changes, item creation, need restoration).
 *
 * Also handles death from starvation/dehydration.
 */
export async function taskExecution(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  handleDeprivationDeaths(ctx);

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;
    if (dwarf.current_task_id === null) continue;

    const task = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (!task) {
      dwarf.current_task_id = null;
      state.dirtyDwarfIds.add(dwarf.id);
      continue;
    }

    // Transition claimed → in_progress
    if (task.status === 'claimed') {
      task.status = 'in_progress';
      state.dirtyTaskIds.add(task.id);
    }

    // Check if dwarf needs to move to the task site
    if (task.target_x !== null && task.target_y !== null && task.target_z !== null) {
      const needsAdjacent = ADJACENT_TASK_TYPES.has(task.task_type);
      const atSite = needsAdjacent
        ? isAdjacentToTarget(dwarf, task)
        : (dwarf.position_x === task.target_x && dwarf.position_y === task.target_y && dwarf.position_z === task.target_z);

      if (!atSite) {
        const moved = moveTowardTarget(dwarf, task, ctx);
        if (!moved) {
          failTask(dwarf, task, state);
        }
        continue;
      }
    }

    // At the task site — do work
    const requiredSkill = getRequiredSkill(task.task_type);
    const skillLevel = requiredSkill
      ? getDwarfSkillLevel(dwarf.id, requiredSkill, state.dwarfSkills)
      : 0;

    let hardness = 1;
    if (task.task_type === 'mine' && task.target_x !== null && task.target_y !== null && task.target_z !== null) {
      const getTile = buildTileLookup(ctx);
      const tileType = getTile(task.target_x, task.target_y, task.target_z);
      hardness = getTileHardness(tileType);
    }

    const workRate = (BASE_WORK_RATE * (1 + skillLevel * 0.1)) / hardness;

    task.work_progress += workRate;
    state.dirtyTaskIds.add(task.id);

    // Restore sleep gradually each tick while sleeping
    if (task.task_type === 'sleep') {
      dwarf.need_sleep = Math.min(MAX_NEED, dwarf.need_sleep + SLEEP_RESTORE_PER_TICK);
      state.dirtyDwarfIds.add(dwarf.id);
    }

    if (task.work_progress >= task.work_required) {
      completeTask(dwarf, task, ctx);
    }
  }
}

function isAdjacentToTarget(dwarf: Dwarf, task: Task): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return true;
  if (dwarf.position_z !== task.target_z) return false;
  const dx = Math.abs(dwarf.position_x - task.target_x);
  const dy = Math.abs(dwarf.position_y - task.target_y);
  return (dx + dy) === 1;
}

function moveTowardTarget(dwarf: Dwarf, task: Task, ctx: SimContext): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return true;

  // Already at the task site — no movement needed
  const needsAdjacent = ADJACENT_TASK_TYPES.has(task.task_type);
  const atSite = needsAdjacent
    ? isAdjacentToTarget(dwarf, task)
    : (dwarf.position_x === task.target_x && dwarf.position_y === task.target_y && dwarf.position_z === task.target_z);
  if (atSite) return true;

  const getTile = buildTileLookup(ctx);

  const nextStep = bfsNextStep(
    { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
    { x: task.target_x, y: task.target_y, z: task.target_z },
    getTile,
    needsAdjacent,
  );

  if (nextStep === null) {
    return false; // No path found
  }

  dwarf.position_x = nextStep.x;
  dwarf.position_y = nextStep.y;
  dwarf.position_z = nextStep.z;
  ctx.state.dirtyDwarfIds.add(dwarf.id);
  return true;
}

/**
 * Returns the hardness multiplier for a given tile type.
 * Higher hardness = more work required to mine.
 * Exported for unit testing.
 */
export function getTileHardness(tileType: string | null): number {
  switch (tileType) {
    case 'soil':       return HARDNESS_SOIL;    // 0.3 — fast
    case 'ore':        return HARDNESS_ORE;     // 1.2
    case 'gem':        return HARDNESS_GEM;     // 1.4
    case 'lava_stone':
    case 'cavern_wall': return HARDNESS_IGNITE; // 1.5 — slow
    default:           return HARDNESS_STONE;   // 1.0 — rock, open_air, etc.
  }
}

function failTask(dwarf: Dwarf, task: Task, state: SimContext['state']): void {
  // Wander tasks should be cancelled outright — resetting them to pending
  // with no assignee creates orphaned autonomous tasks that can never be reclaimed.
  if (task.task_type === 'wander') {
    task.status = 'completed';
    task.completed_at = new Date().toISOString();
  } else {
    task.status = 'pending';
    task.assigned_dwarf_id = null;
    task.work_progress = 0;
  }
  state.dirtyTaskIds.add(task.id);

  dwarf.current_task_id = null;
  state.dirtyDwarfIds.add(dwarf.id);
}
