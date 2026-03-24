import {
  BASE_WORK_RATE,
  SLEEP_RESTORE_PER_TICK,
  MAX_NEED,
  HARDNESS_SOIL,
  HARDNESS_STONE,
  HARDNESS_IGNITE,
  HARDNESS_ORE,
  HARDNESS_GEM,
  CONSCIENTIOUSNESS_WORK_MULTIPLIER,
} from "@pwarf/shared";
import type { Dwarf, Task } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { getDwarfSkillLevel, getRequiredSkill } from "../task-helpers.js";
import { bfsNextStep, type ZResolver } from "../pathfinding.js";
import { buildTileLookup } from "../tile-lookup.js";
import { canPickUp, pickUpItem } from "../inventory.js";
import { handleDeprivationDeaths } from "./deprivation.js";
import { completeTask } from "./task-completion.js";

/** Task types where the dwarf stands adjacent to (not on) the target tile. */
const ADJACENT_TASK_TYPES: ReadonlySet<string> = new Set(['mine', 'build_wall', 'deconstruct']);

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

  // Build z-resolver from fortress deriver for multi-level pathfinding
  const zResolver: ZResolver | undefined = ctx.fortressDeriver
    ? {
        getZForEntrance: (x, y) => ctx.fortressDeriver!.getZForEntrance(x, y),
        getEntranceForZ: (z) => ctx.fortressDeriver!.getEntranceForZ(z),
      }
    : undefined;

  // Build a set of occupied tiles so dwarves don't stack on each other
  const occupiedTiles = new Set<string>();
  for (const d of state.dwarves) {
    if (d.status === 'alive') {
      occupiedTiles.add(`${d.position_x},${d.position_y},${d.position_z}`);
    }
  }

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

    // Haul tasks: if the dwarf doesn't hold the target item yet, walk to it and pick it up
    if (task.task_type === 'haul' && task.target_item_id) {
      const haulItem = state.items.find(i => i.id === task.target_item_id);
      if (haulItem && haulItem.held_by_dwarf_id !== dwarf.id) {
        if (haulItem.position_x !== null && haulItem.position_y !== null && haulItem.position_z !== null) {
          const atItem = dwarf.position_x === haulItem.position_x
            && dwarf.position_y === haulItem.position_y
            && dwarf.position_z === haulItem.position_z;
          if (atItem) {
            if (canPickUp(dwarf.id, haulItem, state.items)) {
              pickUpItem(dwarf, haulItem, state);
            } else {
              failTask(dwarf, task, state);
            }
          } else {
            const getTile = buildTileLookup(ctx);
            const haulStart = { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z };
            const haulGoal = { x: haulItem.position_x, y: haulItem.position_y, z: haulItem.position_z };
            let haulNext = bfsNextStep(haulStart, haulGoal, getTile, false, zResolver);
            if (haulNext) {
              const nextKey = `${haulNext.x},${haulNext.y},${haulNext.z}`;
              if (occupiedTiles.has(nextKey)) {
                // Retry routing around occupied tiles
                haulNext = bfsNextStep(haulStart, haulGoal, getTile, false, zResolver, occupiedTiles) ?? haulNext;
              }
              const finalKey = `${haulNext.x},${haulNext.y},${haulNext.z}`;
              if (!occupiedTiles.has(finalKey)) {
                const prevKey = `${dwarf.position_x},${dwarf.position_y},${dwarf.position_z}`;
                occupiedTiles.delete(prevKey);
                occupiedTiles.add(finalKey);
                dwarf.position_x = haulNext.x;
                dwarf.position_y = haulNext.y;
                dwarf.position_z = haulNext.z;
                state.dirtyDwarfIds.add(dwarf.id);
              }
            } else {
              failTask(dwarf, task, state);
            }
          }
          continue;
        }
        if (haulItem.held_by_dwarf_id !== null) {
          failTask(dwarf, task, state);
          continue;
        }
      }
    }

    // Check if dwarf needs to move to the task site
    if (task.target_x !== null && task.target_y !== null && task.target_z !== null) {
      const needsAdjacent = ADJACENT_TASK_TYPES.has(task.task_type);
      const atSite = needsAdjacent
        ? isAdjacentToTarget(dwarf, task)
        : (dwarf.position_x === task.target_x && dwarf.position_y === task.target_y && dwarf.position_z === task.target_z);

      if (!atSite) {
        const moved = moveTowardTarget(dwarf, task, ctx, occupiedTiles, zResolver);
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

    // Apply conscientiousness modifier: trait=0.5 → no effect, 1.0 → +25%, 0.0 → -25%
    // Clamp to 0.1 minimum to guard against out-of-range trait values (e.g. old -3..3 DB rows).
    const conscientiousnessModifier = dwarf.trait_conscientiousness !== null
      ? Math.max(0.1, 1 + (dwarf.trait_conscientiousness - 0.5) * CONSCIENTIOUSNESS_WORK_MULTIPLIER)
      : 1;
    const workRate = (BASE_WORK_RATE * (1 + skillLevel * 0.1) * conscientiousnessModifier) / hardness;

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

function moveTowardTarget(dwarf: Dwarf, task: Task, ctx: SimContext, occupiedTiles: Set<string>, zResolver?: ZResolver): boolean {
  if (task.target_x === null || task.target_y === null || task.target_z === null) return true;

  // Already at the task site — no movement needed
  const needsAdjacent = ADJACENT_TASK_TYPES.has(task.task_type);
  const atSite = needsAdjacent
    ? isAdjacentToTarget(dwarf, task)
    : (dwarf.position_x === task.target_x && dwarf.position_y === task.target_y && dwarf.position_z === task.target_z);
  if (atSite) return true;

  const getTile = buildTileLookup(ctx);

  const start = { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z };
  const goal = { x: task.target_x, y: task.target_y, z: task.target_z };

  let nextStep = bfsNextStep(start, goal, getTile, needsAdjacent, zResolver);

  if (nextStep === null) {
    return false; // No path found
  }

  // If the next step is occupied, retry BFS routing around occupied tiles.
  // This prevents dwarves from waiting forever when an alternative path exists.
  const nextKey = `${nextStep.x},${nextStep.y},${nextStep.z}`;
  if (occupiedTiles.has(nextKey)) {
    const altStep = bfsNextStep(start, goal, getTile, needsAdjacent, zResolver, occupiedTiles);
    if (altStep) {
      nextStep = altStep;
    } else {
      return true; // All paths blocked — wait, don't fail the task
    }
  }

  // Update occupancy tracking
  const prevKey = `${dwarf.position_x},${dwarf.position_y},${dwarf.position_z}`;
  const finalKey = `${nextStep.x},${nextStep.y},${nextStep.z}`;
  occupiedTiles.delete(prevKey);
  occupiedTiles.add(finalKey);

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
  task.status = 'pending';
  task.assigned_dwarf_id = null;
  task.work_progress = 0;
  state.dirtyTaskIds.add(task.id);

  dwarf.current_task_id = null;
  state.dirtyDwarfIds.add(dwarf.id);
}
