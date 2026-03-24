import {
  STRESS_TANTRUM_THRESHOLD,
  STRESS_TANTRUM_MILD,
  STRESS_TANTRUM_MODERATE,
  STRESS_TANTRUM_SEVERE,
  TANTRUM_DURATION_MILD,
  TANTRUM_DURATION_MODERATE,
  TANTRUM_DURATION_SEVERE,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Tantrum Check Phase
 *
 * - Triggers tantrums when stress reaches the threshold
 * - Cancels the dwarf's current task when a tantrum starts
 * - Recovers dwarves after the minimum tantrum duration AND stress drops below threshold
 *
 * Severity tiers (from the design doc):
 * - Mild (80–89):   ~50 ticks minimum duration
 * - Moderate (90–95): ~100 ticks minimum duration
 * - Severe (96–100):  ~200 ticks minimum duration
 *
 * Note: item destruction and combat are handled by other phases (not yet implemented).
 */
export async function tantrumCheck(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    if (!dwarf.is_in_tantrum) {
      // Check if stress crossed the threshold → trigger tantrum
      if (dwarf.stress_level >= STRESS_TANTRUM_THRESHOLD) {
        dwarf.is_in_tantrum = true;
        state.dirtyDwarfIds.add(dwarf.id);

        // Assign tantrum duration based on severity
        const duration = getTantrumDuration(dwarf.stress_level);
        state.tantrumTicks.set(dwarf.id, duration);

        // Cancel current task so they can't work while tantrumming
        if (dwarf.current_task_id !== null) {
          const task = state.tasks.find(t => t.id === dwarf.current_task_id);
          if (task && task.status !== 'completed' && task.status !== 'cancelled') {
            task.status = 'cancelled';
            state.dirtyTaskIds.add(task.id);
          }
          dwarf.current_task_id = null;
        }
      }
    } else if (dwarf.is_in_tantrum) {
      // Dwarf is already in tantrum — count down and possibly recover
      const remaining = (state.tantrumTicks.get(dwarf.id) ?? 1) - 1;

      if (remaining <= 0 && dwarf.stress_level < STRESS_TANTRUM_THRESHOLD) {
        // Minimum duration elapsed and stress is below threshold → end tantrum
        dwarf.is_in_tantrum = false;
        state.dirtyDwarfIds.add(dwarf.id);
        state.tantrumTicks.delete(dwarf.id);
      } else {
        state.tantrumTicks.set(dwarf.id, Math.max(0, remaining));
      }
    }
  }
}

/**
 * Returns minimum tantrum duration in ticks based on stress level.
 * Exported for unit testing.
 */
export function getTantrumDuration(stressLevel: number): number {
  if (stressLevel >= STRESS_TANTRUM_SEVERE) return TANTRUM_DURATION_SEVERE;
  if (stressLevel >= STRESS_TANTRUM_MODERATE) return TANTRUM_DURATION_MODERATE;
  return TANTRUM_DURATION_MILD;
}
