import type { SimContext } from "./sim-context.js";

/**
 * Flush dirty entities and pending events to Supabase.
 *
 * All five flushes run in parallel via Promise.all. Errors are
 * logged with console.warn but do not throw — the sim keeps running
 * and will retry on the next flush cycle.
 */
export async function flushToSupabase(ctx: SimContext): Promise<void> {
  const { state, supabase } = ctx;

  const dirtyDwarves = state.dwarves.filter((d) =>
    state.dirtyDwarfIds.has(d.id),
  );
  const dirtyItems = state.items.filter((i) => state.dirtyItemIds.has(i.id));
  const dirtyStructures = state.structures.filter((s) =>
    state.dirtyStructureIds.has(s.id),
  );
  const dirtyMonsters = state.monsters.filter((m) =>
    state.dirtyMonsterIds.has(m.id),
  );
  const events = [...state.pendingEvents];

  const promises: PromiseLike<void>[] = [];

  if (dirtyDwarves.length > 0) {
    promises.push(
      supabase
        .from("dwarves")
        .upsert(dirtyDwarves)
        .then(({ error }) => {
          if (error) console.warn(`[flush] dwarves upsert failed: ${error.message}`);
        }),
    );
  }

  if (dirtyItems.length > 0) {
    promises.push(
      supabase
        .from("items")
        .upsert(dirtyItems)
        .then(({ error }) => {
          if (error) console.warn(`[flush] items upsert failed: ${error.message}`);
        }),
    );
  }

  if (dirtyStructures.length > 0) {
    promises.push(
      supabase
        .from("structures")
        .upsert(dirtyStructures)
        .then(({ error }) => {
          if (error) console.warn(`[flush] structures upsert failed: ${error.message}`);
        }),
    );
  }

  if (dirtyMonsters.length > 0) {
    promises.push(
      supabase
        .from("monsters")
        .upsert(dirtyMonsters)
        .then(({ error }) => {
          if (error) console.warn(`[flush] monsters upsert failed: ${error.message}`);
        }),
    );
  }

  if (events.length > 0) {
    promises.push(
      supabase
        .from("world_events")
        .insert(events)
        .then(({ error }) => {
          if (error) console.warn(`[flush] events insert failed: ${error.message}`);
        }),
    );
  }

  await Promise.all(promises);

  // Clear dirty tracking after successful flush
  state.dirtyDwarfIds.clear();
  state.dirtyItemIds.clear();
  state.dirtyStructureIds.clear();
  state.dirtyMonsterIds.clear();
  state.pendingEvents = [];
}
