import {
  BASE_WORK_RATE,
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  MAX_NEED,
  XP_MINE,
  XP_FARM_TILL,
  XP_FARM_PLANT,
  XP_FARM_HARVEST,
  STARVATION_TICKS,
  DEHYDRATION_TICKS,
  FORTRESS_SIZE,
} from "@pwarf/shared";
import type { Dwarf, Task, Item, TaskType } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { getDwarfSkillLevel, getRequiredSkill } from "../task-helpers.js";
import { bfsNextStep, manhattanDistance } from "../pathfinding.js";
import type { TileLookup } from "../pathfinding.js";

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

  // Handle starvation and dehydration tracking for all alive dwarves
  handleDeprivationDeaths(ctx);

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;
    if (dwarf.current_task_id === null) continue;

    const task = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (!task) {
      // Task was deleted or doesn't exist — clear the reference
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
      const needsAdjacent = task.task_type === 'mine'; // Stand next to wall, not inside it
      const atSite = needsAdjacent
        ? isAdjacentToTarget(dwarf, task)
        : (dwarf.position_x === task.target_x && dwarf.position_y === task.target_y && dwarf.position_z === task.target_z);

      if (!atSite) {
        // Move toward target
        const moved = moveTowardTarget(dwarf, task, ctx);
        if (!moved) {
          // No path — fail the task
          failTask(dwarf, task, state);
        }
        continue; // Movement is the dwarf's action this tick
      }
    }

    // At the task site — do work
    const requiredSkill = getRequiredSkill(task.task_type);
    const skillLevel = requiredSkill
      ? getDwarfSkillLevel(dwarf.id, requiredSkill, state.dwarfSkills)
      : 0;
    const workRate = BASE_WORK_RATE * (1 + skillLevel * 0.1);

    task.work_progress += workRate;
    state.dirtyTaskIds.add(task.id);

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

  // Phase 0 simplification: pathfind in 2D only (ignore z-levels since there
  // are no stairs yet). Once horizontally adjacent, teleport to the target z.
  // Will be replaced with real 3D pathfinding + stairs later.
  const getTile: TileLookup = (_x, _y, _z) => {
    if (_x < 0 || _x >= FORTRESS_SIZE || _y < 0 || _y >= FORTRESS_SIZE) return null;
    return 'open_air';
  };

  const needsAdjacent = task.task_type === 'mine';

  // Flatten to 2D: pathfind on dwarf's current z-level toward target x,y
  const goal2d = { x: task.target_x, y: task.target_y, z: dwarf.position_z };
  const nextStep = bfsNextStep(
    { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
    goal2d,
    getTile,
    needsAdjacent,
  );

  if (nextStep === null) {
    // Horizontally at target (or adjacent for mine tasks).
    // Teleport to the correct z-level if needed.
    if (dwarf.position_z !== task.target_z) {
      dwarf.position_z = task.target_z;
      ctx.state.dirtyDwarfIds.add(dwarf.id);
    }
    return true;
  }

  dwarf.position_x = nextStep.x;
  dwarf.position_y = nextStep.y;
  ctx.state.dirtyDwarfIds.add(dwarf.id);
  return true;
}

function completeTask(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  const { state } = ctx;

  task.status = 'completed';
  task.completed_at = new Date().toISOString();
  state.dirtyTaskIds.add(task.id);

  dwarf.current_task_id = null;
  state.dirtyDwarfIds.add(dwarf.id);

  // Apply completion effects based on task type
  switch (task.task_type) {
    case 'mine':
      completeMine(task, ctx);
      awardXp(dwarf.id, 'mining', XP_MINE, state);
      break;
    case 'haul':
      completeHaul(task, ctx);
      break;
    case 'farm_till':
      awardXp(dwarf.id, 'farming', XP_FARM_TILL, state);
      break;
    case 'farm_plant':
      awardXp(dwarf.id, 'farming', XP_FARM_PLANT, state);
      break;
    case 'farm_harvest':
      completeFarmHarvest(task, ctx);
      awardXp(dwarf.id, 'farming', XP_FARM_HARVEST, state);
      break;
    case 'eat':
      completeEat(dwarf, task, ctx);
      break;
    case 'drink':
      completeDrink(dwarf, task, ctx);
      break;
    case 'sleep':
      completeSleep(dwarf, ctx);
      break;
  }
}

function completeMine(task: Task, ctx: SimContext): void {
  // Create a stone item at the mined tile
  if (task.target_x === null || task.target_y === null || task.target_z === null) return;

  const stoneItem: Item = {
    id: crypto.randomUUID(),
    name: 'Stone block',
    category: 'raw_material',
    quality: 'standard',
    material: 'stone',
    weight: 10,
    value: 1,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };

  ctx.state.items.push(stoneItem);
  ctx.state.dirtyItemIds.add(stoneItem.id);
}

function completeHaul(task: Task, _ctx: SimContext): void {
  // Item is moved to stockpile — for Phase 0, the item's location stays in the civ.
  // The target_item_id on the task references the item to move.
  // Future: update item position coordinates.
  if (task.target_item_id) {
    // Item stays in civ — position update will be handled when items get positions
  }
}

function completeFarmHarvest(task: Task, ctx: SimContext): void {
  // Create a food item
  const food: Item = {
    id: crypto.randomUUID(),
    name: 'Plump helmet',
    category: 'food',
    quality: 'standard',
    material: 'plant',
    weight: 1,
    value: 2,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: ctx.civilizationId,
    created_year: ctx.year,
    held_by_dwarf_id: null,
    located_in_civ_id: ctx.civilizationId,
    located_in_ruin_id: null,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
  };

  ctx.state.items.push(food);
  ctx.state.dirtyItemIds.add(food.id);
}

function completeEat(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  // Consume the food item
  if (task.target_item_id) {
    const itemIdx = ctx.state.items.findIndex(i => i.id === task.target_item_id);
    if (itemIdx !== -1) {
      ctx.state.items.splice(itemIdx, 1);
      // Mark for deletion in DB by setting located_in_civ_id to null
      // For simplicity in Phase 0, just remove from cache. Flush won't re-insert.
    }
  }

  dwarf.need_food = Math.min(MAX_NEED, dwarf.need_food + FOOD_RESTORE_AMOUNT);
  ctx.state.dirtyDwarfIds.add(dwarf.id);

  // Reset starvation tracker
  ctx.state.zeroFoodTicks.delete(dwarf.id);
}

function completeDrink(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  // Consume the drink item
  if (task.target_item_id) {
    const itemIdx = ctx.state.items.findIndex(i => i.id === task.target_item_id);
    if (itemIdx !== -1) {
      ctx.state.items.splice(itemIdx, 1);
    }
  }

  dwarf.need_drink = Math.min(MAX_NEED, dwarf.need_drink + DRINK_RESTORE_AMOUNT);
  ctx.state.dirtyDwarfIds.add(dwarf.id);

  // Reset dehydration tracker
  ctx.state.zeroDrinkTicks.delete(dwarf.id);
}

function completeSleep(dwarf: Dwarf, ctx: SimContext): void {
  dwarf.need_sleep = MAX_NEED;
  ctx.state.dirtyDwarfIds.add(dwarf.id);
  // TODO: check if sleeping in bed vs floor for stress penalty
}

function awardXp(dwarfId: string, skillName: string, xpAmount: number, state: SimContext['state']): void {
  const skill = state.dwarfSkills.find(s => s.dwarf_id === dwarfId && s.skill_name === skillName);
  if (skill) {
    skill.xp += xpAmount;
    // Level up check: every 100 XP = 1 level (simple formula for Phase 0)
    const newLevel = Math.floor(skill.xp / 100);
    if (newLevel > skill.level && newLevel <= 20) {
      skill.level = newLevel;
    }
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

function handleDeprivationDeaths(ctx: SimContext): void {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Track ticks at zero food
    if (dwarf.need_food <= 0) {
      const ticks = (state.zeroFoodTicks.get(dwarf.id) ?? 0) + 1;
      state.zeroFoodTicks.set(dwarf.id, ticks);
      if (ticks >= STARVATION_TICKS) {
        killDwarf(dwarf, 'starvation', ctx);
        continue;
      }
    } else {
      state.zeroFoodTicks.delete(dwarf.id);
    }

    // Track ticks at zero drink
    if (dwarf.need_drink <= 0) {
      const ticks = (state.zeroDrinkTicks.get(dwarf.id) ?? 0) + 1;
      state.zeroDrinkTicks.set(dwarf.id, ticks);
      if (ticks >= DEHYDRATION_TICKS) {
        killDwarf(dwarf, 'dehydration', ctx);
        continue;
      }
    } else {
      state.zeroDrinkTicks.delete(dwarf.id);
    }
  }
}

function killDwarf(dwarf: Dwarf, cause: string, ctx: SimContext): void {
  const { state } = ctx;

  dwarf.status = 'dead';
  dwarf.died_year = ctx.year;
  dwarf.cause_of_death = cause;
  state.dirtyDwarfIds.add(dwarf.id);

  // Fail any task assigned to this dwarf
  if (dwarf.current_task_id) {
    const task = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (task) {
      task.status = 'failed';
      task.assigned_dwarf_id = null;
      state.dirtyTaskIds.add(task.id);
    }
    dwarf.current_task_id = null;
  }

  // Check if all dwarves are dead — fortress falls
  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) {
    // Queue fortress fallen event
    state.pendingEvents.push({
      id: crypto.randomUUID(),
      world_id: '',  // Will be set by event firing
      year: ctx.year,
      category: 'fortress_fallen',
      civilization_id: ctx.civilizationId,
      ruin_id: null,
      dwarf_id: null,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `The last dwarf has perished. The fortress has fallen.`,
      event_data: { cause },
      created_at: new Date().toISOString(),
    });
  }
}
