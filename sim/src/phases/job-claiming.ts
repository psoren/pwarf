import {
  SCORE_PRIORITY_WEIGHT,
  SCORE_SKILL_WEIGHT,
  SCORE_DISTANCE_WEIGHT,
} from "@pwarf/shared";
import type { Dwarf, Task } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import {
  isDwarfIdle,
  dwarfHasSkill,
  getDwarfSkillLevel,
  getRequiredSkill,
  isAutonomousTask,
} from "../task-helpers.js";
import { manhattanDistance } from "../pathfinding.js";

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

    for (const task of pendingTasks) {
      if (claimedTaskIds.has(task.id)) continue;

      // Autonomous tasks are self-only
      if (isAutonomousTask(task.task_type) && task.assigned_dwarf_id !== dwarf.id) {
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
      claimTask(dwarf, bestTask, state);
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

  return (task.priority * SCORE_PRIORITY_WEIGHT)
    + (skillLevel * SCORE_SKILL_WEIGHT)
    - (distance * SCORE_DISTANCE_WEIGHT);
}

function claimTask(dwarf: Dwarf, task: Task, state: SimContext['state']): void {
  task.status = 'claimed';
  task.assigned_dwarf_id = dwarf.id;
  dwarf.current_task_id = task.id;

  state.dirtyDwarfIds.add(dwarf.id);
  state.dirtyTaskIds.add(task.id);
}
