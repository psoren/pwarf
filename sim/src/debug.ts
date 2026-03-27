/**
 * Sim Debug Logger
 *
 * Optional debug logging for the sim engine. When enabled, collects
 * structured log entries per tick that can be surfaced in the browser
 * console or inspected in tests.
 *
 * Enable by setting `ctx.debug` to a DebugLogger instance.
 */

export type DebugCategory = 'pathfinding' | 'task_failure' | 'task_cycle' | 'tick_timing';

export interface DebugEntry {
  step: number;
  category: DebugCategory;
  message: string;
  /** Structured data for programmatic inspection. */
  data?: Record<string, unknown>;
}

export class DebugLogger {
  /** All entries collected since last drain. */
  entries: DebugEntry[] = [];

  private step = 0;

  /** Track task failure counts for cycle detection. Keyed by task ID. */
  readonly taskFailureCounts = new Map<string, number>();

  /** Number of failures before a task is flagged as cycling. */
  static readonly CYCLE_THRESHOLD = 3;

  /** Set the current step number (called at the start of each tick). */
  setStep(step: number): void {
    this.step = step;
  }

  warn(category: DebugCategory, message: string, data?: Record<string, unknown>): void {
    this.entries.push({ step: this.step, category, message, data });
  }

  /** Remove and return all collected entries. */
  drain(): DebugEntry[] {
    const out = this.entries;
    this.entries = [];
    return out;
  }

  /** Record a task failure and warn if the task is cycling. */
  recordTaskFailure(taskId: string, taskType: string, dwarfName: string, reason: string): void {
    const count = (this.taskFailureCounts.get(taskId) ?? 0) + 1;
    this.taskFailureCounts.set(taskId, count);
    if (count >= DebugLogger.CYCLE_THRESHOLD) {
      this.warn('task_cycle', `Task ${taskId} (${taskType}) has failed ${count} times — possible stuck cycle`, {
        taskId, taskType, dwarfName, failCount: count, reason,
      });
    }
  }
}

/**
 * Convenience: log a pathfinding failure if debug is enabled.
 * No-ops when ctx.debug is undefined.
 */
export function debugPathfindingFailure(
  debug: DebugLogger | undefined,
  dwarfName: string,
  start: { x: number; y: number; z: number },
  goal: { x: number; y: number; z: number },
  taskType: string,
): void {
  if (!debug) return;
  const dist = Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y) + Math.abs(start.z - goal.z) * 10;
  debug.warn('pathfinding', `Pathfinding failed for ${dwarfName}: (${start.x},${start.y},${start.z}) → (${goal.x},${goal.y},${goal.z}) dist=${dist} task=${taskType}`, {
    dwarfName, start, goal, distance: dist, taskType,
  });
}

/**
 * Convenience: log a task failure if debug is enabled.
 */
export function debugTaskFailure(
  debug: DebugLogger | undefined,
  dwarfName: string,
  taskId: string,
  taskType: string,
  reason: string,
): void {
  if (!debug) return;
  debug.warn('task_failure', `Task failed: ${dwarfName} abandoned ${taskType} (${taskId}) — ${reason}`, {
    dwarfName, taskId, taskType, reason,
  });
  debug.recordTaskFailure(taskId, taskType, dwarfName, reason);
}
