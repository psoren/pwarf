import {
  SCORE_PRIORITY_WEIGHT,
  SCORE_SKILL_WEIGHT,
  SCORE_DISTANCE_WEIGHT,
  SCORE_BEST_SKILL_BONUS,
  DWARF_CARRY_CAPACITY,
} from "@pwarf/shared";
import type { Dwarf, Task } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import {
  isDwarfIdle,
  dwarfHasSkill,
  getDwarfSkillLevel,
  getRequiredSkill,
  isAutonomousTask,
  getBestSkill,
} from "../task-helpers.js";
import { manhattanDistance } from "../pathfinding.js";
import { getCarriedWeight } from "../inventory.js";

/**
 * Job Claiming Phase
 *
 * Finds all idle dwarves (those without a current task) and matches them
 * to available pending tasks. Uses greedy assignment with priority/skill/distance scoring.
 */
export async function jobClaiming(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  const pendingTasks = state.tasks.filter(t => t.status === 'pending');
  if (pendingTasks.length === 0) return;

  const idleDwarves = state.dwarves.filter(isDwarfIdle);
  if (idleDwarves.length === 0) return;

  // Track which tasks get claimed this tick to avoid double-assignment
  const claimedTaskIds = new Set<string>();

  for (const dwarf of idleDwarves) {
    let bestTask: Task | null = null;
    let bestScore = -Infinity;
    const inventoryFull = getCarriedWeight(dwarf.id, state.items) >= DWARF_CARRY_CAPACITY;

    for (const task of pendingTasks) {
      if (claimedTaskIds.has(task.id)) continue;

      // Autonomous tasks are self-only
      if (isAutonomousTask(task.task_type) && task.assigned_dwarf_id !== dwarf.id) {
        continue;
      }

      // Dwarves with full inventory skip mine tasks — haul first
      if (inventoryFull && task.task_type === 'mine') {
        continue;
      }

      // Check skill eligibility
      if (!dwarfHasSkill(dwarf.id, task.task_type, state.dwarfSkills)) {
        continue;
      }

      const score = scoreTask(dwarf, task, state.dwarfSkills);
      if (score > bestScore) {
        bestScore = score;
        bestTask = task;
      }
    }

    if (bestTask) {
      claimTask(dwarf, bestTask, ctx);
      claimedTaskIds.add(bestTask.id);
    }
  }
}

function scoreTask(dwarf: Dwarf, task: Task, skills: SimContext['state']['dwarfSkills']): number {
  const requiredSkill = getRequiredSkill(task.task_type);
  const skillLevel = requiredSkill ? getDwarfSkillLevel(dwarf.id, requiredSkill, skills) : 0;

  const distance = (task.target_x !== null && task.target_y !== null && task.target_z !== null)
    ? manhattanDistance(
        { x: dwarf.position_x, y: dwarf.position_y, z: dwarf.position_z },
        { x: task.target_x, y: task.target_y, z: task.target_z },
      )
    : 0;

  // Bonus when the task matches the dwarf's best skill — makes specialists gravitate
  // toward their specialty even when a different task is slightly closer.
  const bestSkill = getBestSkill(dwarf.id, skills);
  const bestSkillBonus = (requiredSkill && bestSkill === requiredSkill) ? SCORE_BEST_SKILL_BONUS : 0;

  return (task.priority * SCORE_PRIORITY_WEIGHT)
    + (skillLevel * SCORE_SKILL_WEIGHT)
    + bestSkillBonus
    - (distance * SCORE_DISTANCE_WEIGHT);
}

function claimTask(dwarf: Dwarf, task: Task, ctx: SimContext): void {
  const { state } = ctx;
  task.status = 'claimed';
  task.assigned_dwarf_id = dwarf.id;
  dwarf.current_task_id = task.id;

  state.dirtyDwarfIds.add(dwarf.id);
  state.dirtyTaskIds.add(task.id);

  // Only fire events for player-created tasks (not autonomous eat/drink/sleep)
  if (!isAutonomousTask(task.task_type)) {
    const dwarfLabel = `${dwarf.name}${dwarf.surname ? ' ' + dwarf.surname : ''}`;
    const taskLabel = task.task_type.replace(/_/g, ' ');
    state.pendingEvents.push({
      id: ctx.rng.uuid(),
      world_id: '',
      year: ctx.year,
      category: 'discovery',
      civilization_id: ctx.civilizationId,
      ruin_id: null,
      dwarf_id: dwarf.id,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `${dwarfLabel} begins ${taskLabel}.`,
      event_data: { task_type: task.task_type, task_id: task.id },
      created_at: new Date().toISOString(),
    });
  }
}
