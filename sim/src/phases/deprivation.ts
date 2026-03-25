import { STARVATION_TICKS, DEHYDRATION_TICKS, WITNESS_DEATH_STRESS, WITNESS_DEATH_RADIUS } from "@pwarf/shared";
import type { Dwarf } from "@pwarf/shared";
import type { CachedState, SimContext } from "../sim-context.js";
import { createGriefFriendMemories, createGriefSpouseMemories, createWitnessDeathMemories } from "../dwarf-memory.js";

/**
 * Handles starvation and dehydration death tracking for all alive dwarves.
 * Tracks ticks at zero food/drink and kills dwarves that exceed the threshold.
 */
export function handleDeprivationDeaths(ctx: SimContext): void {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Track ticks at zero food
    if (dwarf.need_food <= 0) {
      const ticks = (state.zeroFoodTicks.get(dwarf.id) ?? 0) + 1;
      state.zeroFoodTicks.set(dwarf.id, ticks);
      if (ticks >= STARVATION_TICKS) {
        killDwarf(dwarf, 'starvation', ctx);
        continue;
      }
    } else {
      state.zeroFoodTicks.delete(dwarf.id);
    }

    // Track ticks at zero drink
    if (dwarf.need_drink <= 0) {
      const ticks = (state.zeroDrinkTicks.get(dwarf.id) ?? 0) + 1;
      state.zeroDrinkTicks.set(dwarf.id, ticks);
      if (ticks >= DEHYDRATION_TICKS) {
        killDwarf(dwarf, 'dehydration', ctx);
        continue;
      }
    } else {
      state.zeroDrinkTicks.delete(dwarf.id);
    }
  }
}

export function killDwarf(dwarf: Dwarf, cause: string, ctx: SimContext): void {
  const { state } = ctx;

  dwarf.status = 'dead';
  dwarf.died_year = ctx.year;
  dwarf.cause_of_death = cause;
  dwarf.is_in_tantrum = false;
  state.dirtyDwarfIds.add(dwarf.id);
  state.warnedNeedIds.delete(dwarf.id);

  // Clear any active combat pairs involving this dwarf
  for (const key of state.activeCombatPairs) {
    if (key.endsWith(`:${dwarf.id}`)) {
      state.activeCombatPairs.delete(key);
    }
  }

  // Fail any task assigned to this dwarf
  if (dwarf.current_task_id) {
    const task = state.tasks.find(t => t.id === dwarf.current_task_id);
    if (task) {
      task.status = 'failed';
      task.assigned_dwarf_id = null;
      state.dirtyTaskIds.add(task.id);
    }
    dwarf.current_task_id = null;
  }

  // Drop all items held by this dwarf so they're not permanently lost
  for (const item of state.items) {
    if (item.held_by_dwarf_id === dwarf.id) {
      item.held_by_dwarf_id = null;
      item.position_x = dwarf.position_x;
      item.position_y = dwarf.position_y;
      item.position_z = dwarf.position_z;
      state.dirtyItemIds.add(item.id);
    }
  }

  // Release any bed occupied by this dwarf
  for (const structure of state.structures) {
    if (structure.occupied_by_dwarf_id === dwarf.id) {
      structure.occupied_by_dwarf_id = null;
      state.dirtyStructureIds.add(structure.id);
    }
  }

  // Apply witness stress to nearby alive dwarves
  applyWitnessStress(dwarf, state);

  // Create lasting memories for witnesses, friends, and spouses
  createWitnessDeathMemories(dwarf, state, ctx.year);
  createGriefFriendMemories(dwarf, state, ctx.year);
  createGriefSpouseMemories(dwarf, state, ctx.year);

  // Check if all dwarves are dead — fortress falls
  // Note: dwarf.status is already 'dead' at this point, so filter it out
  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0 && !state.civFallen) {
    // Map sim cause to CauseOfDeath column values
    const causeOfDeath =
      cause === 'starvation' || cause === 'dehydration' ? 'starvation' :
      cause === 'tantrum_spiral' ? 'tantrum_spiral' :
      cause === 'plague' ? 'plague' :
      cause === 'monster attack' ? 'siege' : 'unknown';

    state.civFallen = true;
    state.civFallenCause = causeOfDeath;

    state.pendingEvents.push({
      id: ctx.rng.uuid(),
      world_id: '',
      year: ctx.year,
      category: 'fortress_fallen',
      civilization_id: ctx.civilizationId,
      ruin_id: null,
      dwarf_id: null,
      item_id: null,
      faction_id: null,
      monster_id: null,
      description: `The last dwarf has perished. The fortress has fallen.`,
      event_data: { cause },
      created_at: new Date().toISOString(),
    });
  }
}

/**
 * Applies stress to alive dwarves who are close enough to witness the death.
 * Exported for unit testing.
 */
export function applyWitnessStress(deceased: Dwarf, state: CachedState): void {
  for (const witness of state.dwarves) {
    if (witness.id === deceased.id) continue;
    if (witness.status !== 'alive') continue;
    if (witness.position_z !== deceased.position_z) continue;
    const dist =
      Math.abs(witness.position_x - deceased.position_x) +
      Math.abs(witness.position_y - deceased.position_y);
    if (dist <= WITNESS_DEATH_RADIUS) {
      witness.stress_level = Math.min(100, witness.stress_level + WITNESS_DEATH_STRESS);
      state.dirtyDwarfIds.add(witness.id);
    }
  }
}
