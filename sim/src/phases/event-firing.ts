import { randomUUID } from "node:crypto";
import type { SimContext } from "../sim-context.js";

/**
 * Event Firing Phase
 *
 * Scans for notable state changes this tick and queues world events
 * for the activity log. Events are flushed to Supabase by the write cycle.
 *
 * Phase 0 events:
 * - Dwarf death (starvation, dehydration)
 * - Task completion (mining, farming)
 * - Critical need warnings
 * - Fortress fallen
 */
export async function eventFiring(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  // Check for critical needs (fire event once when crossing threshold)
  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    // Critical food warning at need_food < 10
    if (dwarf.need_food < 10 && dwarf.need_food >= 9.8) {
      state.pendingEvents.push({
        id: randomUUID(),
        world_id: '',
        year: ctx.year,
        category: 'death', // Using existing category — will be 'warning' later
        civilization_id: ctx.civilizationId,
        ruin_id: null,
        dwarf_id: dwarf.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `${dwarf.name}${dwarf.surname ? ' ' + dwarf.surname : ''} is starving.`,
        event_data: { need: 'food', value: dwarf.need_food },
        created_at: new Date().toISOString(),
      });
    }

    // Critical drink warning
    if (dwarf.need_drink < 10 && dwarf.need_drink >= 9.8) {
      state.pendingEvents.push({
        id: randomUUID(),
        world_id: '',
        year: ctx.year,
        category: 'death',
        civilization_id: ctx.civilizationId,
        ruin_id: null,
        dwarf_id: dwarf.id,
        item_id: null,
        faction_id: null,
        monster_id: null,
        description: `${dwarf.name}${dwarf.surname ? ' ' + dwarf.surname : ''} is dehydrated.`,
        event_data: { need: 'drink', value: dwarf.need_drink },
        created_at: new Date().toISOString(),
      });
    }
  }

  // Task completion events are queued directly by the task-execution phase.
  // Death events and fortress-fallen events are also queued there.
  // This phase is a catch-all for events that don't fit neatly into other phases.
}
