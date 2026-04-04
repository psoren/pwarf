import type { CachedState } from "./sim-context.js";

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled', 'failed']);

/**
 * Remove terminal tasks from state.tasks to prevent unbounded growth.
 * Tasks referenced by a live dwarf's current_task_id are preserved.
 *
 * In the DB path (`skipDirtyCheck=false`, the default), dirty and
 * newly-created tasks are kept so flushState can persist them first.
 *
 * In headless mode (`skipDirtyCheck=true`), dirty flags are ignored
 * because there is no DB flush to wait for — terminal tasks are
 * removed immediately once no dwarf references them.
 */
export function pruneTerminalTasks(state: CachedState, skipDirtyCheck = false): void {
  const referencedTaskIds = new Set<string>();
  for (const d of state.dwarves) {
    if (d.current_task_id) referencedTaskIds.add(d.current_task_id);
  }

  // Also keep newTasks IDs — they haven't been flushed yet
  const newTaskIds = new Set(state.newTasks.map(t => t.id));

  state.tasks = state.tasks.filter(t => {
    if (!TERMINAL_STATUSES.has(t.status)) return true;
    if (referencedTaskIds.has(t.id)) return true;
    if (!skipDirtyCheck) {
      // Keep tasks that are dirty (status changed this tick) or newly created
      if (state.dirtyTaskIds.has(t.id)) return true;
      if (newTaskIds.has(t.id)) return true;
    }
    return false;
  });

  // Rebuild the task ID index after pruning
  state.taskById.clear();
  for (const t of state.tasks) state.taskById.set(t.id, t);
}
