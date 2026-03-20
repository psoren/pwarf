import {
  ELDER_DEATH_AGE,
  ELDER_DEATH_CHANCE_PER_YEAR,
  IMMIGRATION_CHANCE_PER_YEAR,
  IMMIGRATION_MAX_ARRIVALS,
  FORTRESS_SIZE,
} from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";
import { createImmigrantDwarf } from "../dwarf-factory.js";
import { diseasePhase } from "./disease.js";
import { applyWitnessStress } from "./deprivation.js";
import { createWitnessDeathMemories, decayMemories } from "../dwarf-memory.js";

/**
 * Yearly Rollup Phase
 *
 * Runs once every STEPS_PER_YEAR steps. Handles long-cadence updates:
 * - Aging: increments dwarf ages, triggers old-age death checks
 * - Immigration: new dwarves may arrive each year (starting year 2)
 *
 * Not yet implemented: skill ups, faction drift, ruin decay.
 */
export async function yearlyRollup(ctx: SimContext): Promise<void> {
  const { state, rng, year, civilizationId } = ctx;

  let deathsThisYear = 0;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Increment age
    dwarf.age += 1;
    state.dirtyDwarfIds.add(dwarf.id);

    // Natural death check for elderly dwarves
    // Each year past ELDER_DEATH_AGE rolls independently
    if (dwarf.age > ELDER_DEATH_AGE) {
      const yearsOverLimit = dwarf.age - ELDER_DEATH_AGE;
      if (rng.random() < ELDER_DEATH_CHANCE_PER_YEAR * yearsOverLimit) {
        dwarf.status = 'dead';
        dwarf.died_year = year;
        dwarf.cause_of_death = 'unknown';
        deathsThisYear += 1;
        state.ghostDwarfIds.add(dwarf.id);
        applyWitnessStress(dwarf, state);
        createWitnessDeathMemories(dwarf, state, year);

        if (dwarf.current_task_id) {
          const task = state.tasks.find(t => t.id === dwarf.current_task_id);
          if (task && task.status !== 'completed' && task.status !== 'cancelled') {
            task.status = 'cancelled';
            state.dirtyTaskIds.add(task.id);
          }
          dwarf.current_task_id = null;
        }

        state.pendingEvents.push({
          id: rng.uuid(),
          world_id: '',
          year,
          category: 'death',
          civilization_id: civilizationId,
          ruin_id: null,
          dwarf_id: dwarf.id,
          item_id: null,
          faction_id: null,
          monster_id: null,
          description: `${dwarfName(dwarf)} has died of old age at ${dwarf.age}.`,
          event_data: { cause: 'old_age', age: dwarf.age },
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // Immigration — new dwarves arrive starting from year 2
  let migrantsThisYear = 0;
  if (year >= 2 && rng.random() < IMMIGRATION_CHANCE_PER_YEAR) {
    const count = rng.int(1, IMMIGRATION_MAX_ARRIVALS);
    migrantsThisYear = count;
    const center = Math.floor(FORTRESS_SIZE / 2);
    const immigrants = Array.from({ length: count }, (_, i) =>
      createImmigrantDwarf(rng, civilizationId, year, center + i, center)
    );

    for (const immigrant of immigrants) {
      state.dwarves.push(immigrant);
      state.dirtyDwarfIds.add(immigrant.id);
    }

    const names = immigrants.map(d => dwarfName(d)).join(', ');
    const noun = count === 1 ? 'dwarf has' : 'dwarves have';
    state.pendingEvents.push({
      id: rng.uuid(),
      world_id: '',
      year,
      category: 'migration',
      civilization_id: civilizationId,
      ruin_id: null,
      dwarf_id: null,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `${count} new ${noun} arrived at the fortress: ${names}.`,
      event_data: { count, names: immigrants.map(d => dwarfName(d)) },
      created_at: new Date().toISOString(),
    });
  }

  // Disease: outbreak, spread, damage, and recovery
  diseasePhase(ctx);

  // Memory decay: strip expired memories from all alive dwarves
  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;
    decayMemories(dwarf, year, state);
  }

  // Year-end summary event
  const population = state.dwarves.filter(d => d.status === 'alive').length;
  const deathClause = deathsThisYear === 0
    ? 'No dwarves died.'
    : deathsThisYear === 1 ? '1 dwarf died this year.' : `${deathsThisYear} dwarves died this year.`;
  const migrantClause = migrantsThisYear === 0
    ? ''
    : migrantsThisYear === 1 ? ' 1 migrant arrived.' : ` ${migrantsThisYear} migrants arrived.`;
  state.pendingEvents.push({
    id: rng.uuid(),
    world_id: '',
    year,
    category: 'discovery',
    civilization_id: civilizationId,
    ruin_id: null,
    dwarf_id: null,
    item_id: null,
    faction_id: null,
    monster_id: null,
    description: `Year ${year} ends. Population: ${population} dwarves. ${deathClause}${migrantClause}`,
    event_data: { type: 'year_rollup', population, deaths: deathsThisYear, migrants: migrantsThisYear },
    created_at: new Date().toISOString(),
  });
}
