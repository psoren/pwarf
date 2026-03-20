import type { Dwarf } from "@pwarf/shared";
import type { SimContext } from "../sim-context.js";
import { dwarfName } from "../dwarf-utils.js";

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

    checkCriticalNeed(dwarf, 'food', dwarf.need_food, ctx);
    checkCriticalNeed(dwarf, 'drink', dwarf.need_drink, ctx);
  }

  // Task completion events are queued directly by the task-execution phase.
  // Death events and fortress-fallen events are also queued there.
  // This phase is a catch-all for events that don't fit neatly into other phases.
}

const NEED_MESSAGE: Record<string, string> = {
  food: 'is starving',
  drink: 'is dehydrated',
};

function checkCriticalNeed(
  dwarf: Dwarf,
  needType: 'food' | 'drink',
  currentValue: number,
  ctx: SimContext,
): void {
  const { state } = ctx;

  if (currentValue < CRITICAL_NEED_THRESHOLD) {
    const warned = state.warnedNeedIds.get(dwarf.id);
    if (warned?.has(needType)) return; // already warned this crossing

    // Lazy-init the Set only when we actually need to record a warning
    const warningSet = warned ?? new Set<string>();
    warningSet.add(needType);
    if (!warned) state.warnedNeedIds.set(dwarf.id, warningSet);

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
      description: `${dwarfName(dwarf)} ${NEED_MESSAGE[needType]}.`,
      event_data: { need: needType, value: currentValue },
      created_at: new Date().toISOString(),
    });
  } else if (currentValue >= CRITICAL_NEED_RESET) {
    state.warnedNeedIds.get(dwarf.id)?.delete(needType);
  }
}
