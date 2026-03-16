import type { SimContext } from "./sim-context.js";

/**
 * Flush all dirty cached state to Supabase.
 *
 * Collects entities whose IDs appear in the dirty-tracking sets,
 * upserts/inserts them in parallel, then clears the sets.
 * Failures are logged but never thrown so the sim keeps running.
 */
export async function flushToSupabase(ctx: SimContext): Promise<void> {
  const { supabase, state } = ctx;
  const promises: Promise<void>[] = [];

  // --- Dirty dwarves ---
  if (state.dirtyDwarfIds.size > 0) {
    const dirtyDwarves = state.dwarves.filter((d) =>
      state.dirtyDwarfIds.has(d.id),
    );
    state.dirtyDwarfIds.clear();
    promises.push(
      (async () => {
        const { error } = await supabase.from("dwarves").upsert(dirtyDwarves);
        if (error) {
          console.warn("[flush] failed to upsert dwarves:", error.message);
        }
      })(),
    );
  }

  // --- Dirty items ---
  if (state.dirtyItemIds.size > 0) {
    const dirtyItems = state.items.filter((i) =>
      state.dirtyItemIds.has(i.id),
    );
    state.dirtyItemIds.clear();
    promises.push(
      (async () => {
        const { error } = await supabase.from("items").upsert(dirtyItems);
        if (error) {
          console.warn("[flush] failed to upsert items:", error.message);
        }
      })(),
    );
  }

  // --- Dirty structures ---
  if (state.dirtyStructureIds.size > 0) {
    const dirtyStructures = state.structures.filter((s) =>
      state.dirtyStructureIds.has(s.id),
    );
    state.dirtyStructureIds.clear();
    promises.push(
      (async () => {
        const { error } = await supabase
          .from("structures")
          .upsert(dirtyStructures);
        if (error) {
          console.warn("[flush] failed to upsert structures:", error.message);
        }
      })(),
    );
  }

  // --- Dirty monsters ---
  if (state.dirtyMonsterIds.size > 0) {
    const dirtyMonsters = state.monsters.filter((m) =>
      state.dirtyMonsterIds.has(m.id),
    );
    state.dirtyMonsterIds.clear();
    promises.push(
      (async () => {
        const { error } = await supabase
          .from("monsters")
          .upsert(dirtyMonsters);
        if (error) {
          console.warn("[flush] failed to upsert monsters:", error.message);
        }
      })(),
    );
  }

  // --- Pending events ---
  if (state.pendingEvents.length > 0) {
    const events = state.pendingEvents;
    state.pendingEvents = [];
    promises.push(
      (async () => {
        const { error } = await supabase.from("world_events").insert(events);
        if (error) {
          console.warn(
            "[flush] failed to insert world_events:",
            error.message,
          );
        }
      })(),
    );
  }

  await Promise.all(promises);
}
