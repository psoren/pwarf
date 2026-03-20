import type { SimContext } from "../sim-context.js";

/**
 * Autonomous task types that should NOT be retried after failure.
 * These are self-generated per-dwarf needs; when they fail the dwarf
 * will simply re-generate them on the next need-satisfaction pass.
 */
const NO_RETRY_TYPES: ReadonlySet<string> = new Set([
  'eat',
  'drink',
  'sleep',
  'wander',
  'haul',
]);

/**
 * Task Recovery Phase
 *
 * When a dwarf dies or abandons a task, deprivation.ts sets it to
 * `failed` and clears `assigned_dwarf_id`. Without recovery, that
 * work is permanently lost — no other dwarf can pick it up.
 *
 * This phase scans for unassigned failed tasks each tick and either:
 * - Resets design tasks back to `pending` so another dwarf can claim them.
 * - Cancels tasks that are no longer valid (autonomous types that
 *   self-generate, or tasks whose target tile no longer exists).
 */
export function taskRecovery(ctx: SimContext): void {
  const { state } = ctx;

  for (const task of state.tasks) {
    if (task.status !== 'failed') continue;
    if (task.assigned_dwarf_id !== null) continue;

    // Autonomous tasks self-regenerate — don't retry them
    if (NO_RETRY_TYPES.has(task.task_type)) {
      task.status = 'cancelled';
      state.dirtyTaskIds.add(task.id);
      continue;
    }

    // Mine tasks: cancel if the tile has already been mined (override shows
    // a non-minable type like open_air). If no override exists the tile is
    // still in its generated state and is safe to retry.
    if (task.task_type === 'mine' &&
        task.target_x !== null && task.target_y !== null && task.target_z !== null) {
      const key = `${task.target_x},${task.target_y},${task.target_z}`;
      const override = state.fortressTileOverrides.get(key);
      const minable = new Set(['rock', 'soil', 'stone', 'ore', 'gem', 'ignite']);
      if (override && !minable.has(override.tile_type)) {
        task.status = 'cancelled';
        state.dirtyTaskIds.add(task.id);
        continue;
      }
    }

    // All other design tasks (build, brew, cook, farm, engrave, smith, etc.)
    // are reset to pending — another dwarf will pick them up
    task.status = 'pending';
    state.dirtyTaskIds.add(task.id);
  }
}
