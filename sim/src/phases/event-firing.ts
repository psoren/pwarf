import type { SimContext } from "../sim-context.js";

/** Need threshold below which a critical warning fires */
const CRITICAL_NEED_THRESHOLD = 10;

/** Need value above which the warning resets (allows re-firing on next crossing) */
const CRITICAL_NEED_RESET = 20;

/**
 * Event Firing Phase
 *
 * Scans for notable state changes this tick and queues world events
 * for the activity log. Events are flushed to Supabase by the write cycle.
 *
 * Phase 0 events:
 * - Dwarf death (starvation, dehydration)
 * - Task completion (mining, farming)
 * - Critical need warnings (fires once per crossing, resets when need recovers)
 * - Fortress fallen
 */
export async function eventFiring(ctx: SimContext): Promise<void> {
  const { state } = ctx;

  for (const dwarf of state.dwarves) {
    if (dwarf.status !== 'alive') continue;

    const warned = state.warnedNeedIds.get(dwarf.id) ?? new Set<string>();

    // Critical food warning — fires once when crossing below threshold
    if (dwarf.need_food < CRITICAL_NEED_THRESHOLD) {
      if (!warned.has('food')) {
        warned.add('food');
        state.warnedNeedIds.set(dwarf.id, warned);
        state.pendingEvents.push({
          id: ctx.rng.uuid(),
          world_id: '',
          year: ctx.year,
          category: 'discovery',
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
    } else if (dwarf.need_food >= CRITICAL_NEED_RESET) {
      warned.delete('food');
    }

    // Critical drink warning — fires once when crossing below threshold
    if (dwarf.need_drink < CRITICAL_NEED_THRESHOLD) {
      if (!warned.has('drink')) {
        warned.add('drink');
        state.warnedNeedIds.set(dwarf.id, warned);
        state.pendingEvents.push({
          id: ctx.rng.uuid(),
          world_id: '',
          year: ctx.year,
          category: 'discovery',
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
    } else if (dwarf.need_drink >= CRITICAL_NEED_RESET) {
      warned.delete('drink');
    }
  }

  // Task completion events are queued directly by the task-execution phase.
  // Death events and fortress-fallen events are also queued there.
  // This phase is a catch-all for events that don't fit neatly into other phases.
}
