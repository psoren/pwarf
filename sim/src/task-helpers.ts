import type { Dwarf, DwarfSkill, Task, TaskType, Item } from "@pwarf/shared";
import type { CachedState, SimContext } from "./sim-context.js";

/** Map task types to the skill name required. null means any dwarf can do it. */
const TASK_SKILL_MAP: Record<TaskType, string | null> = {
  mine: 'mining',
  haul: null,
  farm_till: 'farming',
  farm_plant: 'farming',
  farm_harvest: 'farming',
  eat: null,
  drink: null,
  sleep: null,
  build_wall: 'building',
  build_floor: 'building',
  build_bed: 'building',
  build_well: 'building',
  build_mushroom_garden: 'building',
  deconstruct: 'building',
  wander: null,
  smooth: 'building',
  engrave: 'engraving',
  engrave_memorial: 'engraving',
  brew: 'brewing',
  cook: 'cooking',
  smith: 'smithing',
  create_artifact: null,
  forage: null,
};

/** Get the skill name required for a task type, or null if no skill needed. */
export function getRequiredSkill(taskType: TaskType): string | null {
  return TASK_SKILL_MAP[taskType];
}

/** Get a dwarf's skill level for a given skill name. Returns 0 if no skill record exists. */
export function getDwarfSkillLevel(dwarfId: string, skillName: string, skills: DwarfSkill[]): number {
  const skill = skills.find(s => s.dwarf_id === dwarfId && s.skill_name === skillName);
  return skill?.level ?? 0;
}

/** Any dwarf can attempt any task — skills only affect work speed, not eligibility. */
export function dwarfHasSkill(_dwarfId: string, _taskType: TaskType, _skills: DwarfSkill[]): boolean {
  return true;
}

/** Check if a dwarf is idle (alive, no current task, not in tantrum). */
export function isDwarfIdle(dwarf: Dwarf): boolean {
  return dwarf.status === 'alive' && dwarf.current_task_id === null && !dwarf.is_in_tantrum;
}

/** Autonomous task types that are self-only. */
const AUTONOMOUS_TASKS: ReadonlySet<TaskType> = new Set(['eat', 'drink', 'sleep']);

/** Check if a task type is autonomous (self-only). */
export function isAutonomousTask(taskType: TaskType): boolean {
  return AUTONOMOUS_TASKS.has(taskType);
}

/** Get the skill name a dwarf is best at (highest level). Returns null if dwarf has no skills. */
export function getBestSkill(dwarfId: string, skills: DwarfSkill[]): string | null {
  let best: string | null = null;
  let bestLevel = -1;
  for (const s of skills) {
    if (s.dwarf_id === dwarfId && s.level > bestLevel) {
      bestLevel = s.level;
      best = s.skill_name;
    }
  }
  return best;
}

/** Create a new task and add it to the cached state. */
export function createTask(
  ctx: SimContext,
  opts: {
    task_type: TaskType;
    priority?: number;
    target_x?: number | null;
    target_y?: number | null;
    target_z?: number | null;
    target_item_id?: string | null;
    work_required?: number;
    assigned_dwarf_id?: string | null;
  },
): Task {
  const task: Task = {
    id: ctx.rng.uuid(),
    civilization_id: ctx.civilizationId,
    task_type: opts.task_type,
    status: 'pending',
    priority: opts.priority ?? 5,
    assigned_dwarf_id: opts.assigned_dwarf_id ?? null,
    target_x: opts.target_x ?? null,
    target_y: opts.target_y ?? null,
    target_z: opts.target_z ?? null,
    target_item_id: opts.target_item_id ?? null,
    work_progress: 0,
    work_required: opts.work_required ?? 100,
    created_at: new Date().toISOString(),
    completed_at: null,
  };

  ctx.state.tasks.push(task);
  ctx.state.newTasks.push(task);
  return task;
}

/** Find the nearest item of a given category in the fortress. */
export function findNearestItem(
  items: Item[],
  category: string,
  fromX: number,
  fromY: number,
  fromZ: number,
): Item | null {
  let nearest: Item | null = null;
  let nearestDist = Infinity;

  for (const item of items) {
    if (item.category !== category) continue;
    // Items must be in a civilization (not held by a dwarf or in a ruin)
    if (item.located_in_civ_id === null) continue;
    if (item.held_by_dwarf_id !== null) continue;

    // Items don't have position yet in the schema, so for Phase 0
    // we treat all stockpile items as distance 0 (same fortress).
    // This is a simplification — items will get positions later.
    const dist = 0;
    if (dist < nearestDist) {
      nearest = item;
      nearestDist = dist;
    }
  }

  return nearest;
}
