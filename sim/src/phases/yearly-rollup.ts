import {
  ELDER_DEATH_AGE,
  ELDER_DEATH_CHANCE_PER_YEAR,
  IMMIGRATION_CHANCE_PER_YEAR,
  IMMIGRATION_MAX_ARRIVALS,
  FORTRESS_SIZE,
  CARAVAN_INTERVAL_YEARS,
  CARAVAN_DRINK_COUNT,
  CARAVAN_FOOD_COUNT,
} from "@pwarf/shared";
import type { Item } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";
import { createImmigrantDwarf } from "../dwarf-factory.js";
import { applyWitnessStress } from "./deprivation.js";
import { createGriefFriendMemories, createGriefSpouseMemories, createWitnessDeathMemories, decayMemories } from "../dwarf-memory.js";
import { relationshipFormationPhase } from "./relationship-formation.js";

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
        applyWitnessStress(dwarf, state);
        createWitnessDeathMemories(dwarf, state, year);
        createGriefFriendMemories(dwarf, state, year);
        createGriefSpouseMemories(dwarf, state, year);

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

  // Relationship formation: dwarves form acquaintances and friendships
  relationshipFormationPhase(ctx);

  // Memory decay: strip expired memories from all alive dwarves
  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;
    decayMemories(dwarf, year, state);
  }

  // Year-end civilization metadata sync
  const population = state.dwarves.filter(d => d.status === 'alive').length;
  const wealth = state.items
    .filter(i => i.located_in_civ_id === civilizationId)
    .reduce((sum, i) => sum + i.value, 0);
  if (population !== state.civPopulation || wealth !== state.civWealth) {
    state.civPopulation = population;
    state.civWealth = wealth;
    state.civDirty = true;
  }
  if (population > state.civPeakPopulation) {
    state.civPeakPopulation = population;
  }

  // Trade caravan — arrives every CARAVAN_INTERVAL_YEARS
  if (year % CARAVAN_INTERVAL_YEARS === 0) {
    const center = Math.floor(FORTRESS_SIZE / 2);
    const caravanItems: Item[] = [];

    // Drinks
    for (let i = 0; i < CARAVAN_DRINK_COUNT; i++) {
      caravanItems.push({
        id: rng.uuid(),
        name: 'Dwarven ale',
        category: 'drink',
        quality: 'standard',
        material: 'plant',
        weight: 1,
        value: 3,
        is_artifact: false,
        created_by_dwarf_id: null,
        created_in_civ_id: civilizationId,
        created_year: year,
        held_by_dwarf_id: null,
        located_in_civ_id: civilizationId,
        located_in_ruin_id: null,
        position_x: center,
        position_y: center,
        position_z: 0,
        lore: null,
        properties: {},
        created_at: new Date().toISOString(),
      });
    }

    // Food
    for (let i = 0; i < CARAVAN_FOOD_COUNT; i++) {
      caravanItems.push({
        id: rng.uuid(),
        name: 'Cured meat',
        category: 'food',
        quality: 'standard',
        material: 'meat',
        weight: 1,
        value: 4,
        is_artifact: false,
        created_by_dwarf_id: null,
        created_in_civ_id: civilizationId,
        created_year: year,
        held_by_dwarf_id: null,
        located_in_civ_id: civilizationId,
        located_in_ruin_id: null,
        position_x: center,
        position_y: center,
        position_z: 0,
        lore: null,
        properties: {},
        created_at: new Date().toISOString(),
      });
    }

    // 1–3 raw materials
    const rawMaterialNames = ['Granite block', 'Iron ore', 'Copper ore'];
    const rawCount = rng.int(1, 3);
    for (let i = 0; i < rawCount; i++) {
      const name = rawMaterialNames[rng.int(0, rawMaterialNames.length - 1)];
      caravanItems.push({
        id: rng.uuid(),
        name,
        category: 'raw_material',
        quality: 'standard',
        material: name.includes('ore') ? 'metal' : 'stone',
        weight: 3,
        value: 2,
        is_artifact: false,
        created_by_dwarf_id: null,
        created_in_civ_id: civilizationId,
        created_year: year,
        held_by_dwarf_id: null,
        located_in_civ_id: civilizationId,
        located_in_ruin_id: null,
        position_x: center,
        position_y: center,
        position_z: 0,
        lore: null,
        properties: {},
        created_at: new Date().toISOString(),
      });
    }

    for (const item of caravanItems) {
      state.items.push(item);
      state.dirtyItemIds.add(item.id);
    }

    // Fire trade_caravan_arrival event
    state.pendingEvents.push({
      id: rng.uuid(),
      world_id: '',
      year,
      category: 'trade_caravan_arrival',
      civilization_id: civilizationId,
      ruin_id: null,
      dwarf_id: null,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: 'A trade caravan has arrived from Mountainhome!',
      event_data: { type: 'trade_caravan_arrival', item_count: caravanItems.length },
      created_at: new Date().toISOString(),
    });

    // Add positive memory to all living dwarves
    for (const dwarf of state.dwarves) {
      if (dwarf.status !== 'alive') continue;
      dwarf.memories.push({ text: 'was glad to see the caravan', tick: 0, sentiment: 'positive' });
      state.dirtyDwarfIds.add(dwarf.id);
    }
  }

  // Year-end summary event
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
