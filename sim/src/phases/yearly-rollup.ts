import { ELDER_DEATH_AGE, ELDER_DEATH_CHANCE_PER_YEAR } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

/**
 * Yearly Rollup Phase
 *
 * Runs once every STEPS_PER_YEAR steps. Handles long-cadence updates:
 * - Aging: increments dwarf ages, triggers old-age death checks
 *
 * Not yet implemented: skill ups, immigration, faction drift, disease, ruin decay.
 */
export async function yearlyRollup(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Increment age
    dwarf.age += 1;
    state.dirtyDwarfIds.add(dwarf.id);

    // Natural death check for elderly dwarves
    // Each year past ELDER_DEATH_AGE rolls independently
    if (dwarf.age > ELDER_DEATH_AGE) {
      const yearsOverLimit = dwarf.age - ELDER_DEATH_AGE;
      if (ctx.rng.random() < ELDER_DEATH_CHANCE_PER_YEAR * yearsOverLimit) {
        dwarf.status = 'dead';
        dwarf.died_year = ctx.year;
        dwarf.cause_of_death = 'unknown';

        if (dwarf.current_task_id) {
          const task = state.tasks.find(t => t.id === dwarf.current_task_id);
          if (task && task.status !== 'completed' && task.status !== 'cancelled') {
            task.status = 'cancelled';
            state.dirtyTaskIds.add(task.id);
          }
          dwarf.current_task_id = null;
        }

        state.pendingEvents.push({
          id: ctx.rng.uuid(),
          world_id: '',
          year: ctx.year,
          category: 'death',
          civilization_id: ctx.civilizationId,
          ruin_id: null,
          dwarf_id: dwarf.id,
          item_id: null,
          faction_id: null,
          monster_id: null,
          description: `${dwarf.name}${dwarf.surname ? ' ' + dwarf.surname : ''} has died of old age at ${dwarf.age}.`,
          event_data: { cause: 'old_age', age: dwarf.age },
          created_at: new Date().toISOString(),
        });
      }
    }
  }
}
