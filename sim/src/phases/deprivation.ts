import { STARVATION_TICKS, DEHYDRATION_TICKS } from "@pwarf/shared";
import type { Dwarf } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";

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
  state.dirtyDwarfIds.add(dwarf.id);

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

  // Release any bed occupied by this dwarf
  for (const structure of state.structures) {
    if (structure.occupied_by_dwarf_id === dwarf.id) {
      structure.occupied_by_dwarf_id = null;
      state.dirtyStructureIds.add(structure.id);
    }
  }

  // Check if all dwarves are dead — fortress falls
  const aliveDwarves = state.dwarves.filter(d => d.status === 'alive');
  if (aliveDwarves.length === 0) {
    state.pendingEvents.push({
      id: crypto.randomUUID(),
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
