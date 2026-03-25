import type { Task } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";

/** Guard against overlapping flushes — if a flush takes longer than the
 *  interval, skip subsequent calls instead of piling up concurrent writes. */
let flushInProgress = false;

/**
 * Flush dirty entities and pending events to Supabase.
 *
 * All writes are sequential to avoid gotrue auth-lock contention.
 * Parallel Supabase calls each independently acquire the browser auth
 * lock, causing 5-second timeouts and UI lag. Sequential writes use
 * one lock acquisition for the whole flush.
 *
 * Errors are logged with console.warn but do not throw — the sim keeps
 * running and will retry on the next flush cycle.
 */
export async function flushToSupabase(ctx: SimContext): Promise<void> {
  if (flushInProgress) return;
  flushInProgress = true;
  try {
    await doFlush(ctx);
  } finally {
    flushInProgress = false;
  }
}

async function doFlush(ctx: SimContext): Promise<void> {
  const { state, supabase } = ctx;

  // ── Pre-flush cleanup: fix dangling foreign keys ──────────────────────
  sanitizeDanglingRefs(state);

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
  const dirtyTasks = state.tasks.filter((t) => state.dirtyTaskIds.has(t.id));
  const newTasks = [...state.newTasks];
  const events = [...state.pendingEvents];
  const newRelationships = [...state.newDwarfRelationships];
  const dirtyRelationships = state.dwarfRelationships.filter((r) =>
    state.dirtyDwarfRelationshipIds.has(r.id),
  );

  // ── Flush sequentially in FK-safe order ───────────────────────────────
  // FK chain: tasks.target_item_id → items.id, dwarves.current_task_id → tasks.id
  // Sequential writes avoid gotrue auth-lock contention (one lock per request,
  // released before the next request acquires it).

  // 1. Items first — tasks reference them via target_item_id
  if (dirtyItems.length > 0) {
    const { error } = await supabase.from("items").upsert(dirtyItems);
    if (error) console.warn(`[flush] items upsert failed: ${error.message}`);
  }

  // 2. Structures — sleep tasks reference them via target_item_id
  if (dirtyStructures.length > 0) {
    const { error } = await supabase.from("structures").upsert(dirtyStructures);
    if (error) console.warn(`[flush] structures upsert failed: ${error.message}`);
  }

  // 3. Tasks — dwarves reference them via current_task_id
  const taskById = new Map<string, Task>();
  for (const t of newTasks) taskById.set(t.id, t);
  for (const t of dirtyTasks) taskById.set(t.id, t);
  const dedupedTasks = [...taskById.values()];
  if (dedupedTasks.length > 0) {
    const { error } = await supabase.from("tasks").upsert(dedupedTasks);
    if (error) console.warn(`[flush] tasks upsert failed: ${error.message}`);
  }

  // 4. Dwarves
  if (dirtyDwarves.length > 0) {
    const rounded = dirtyDwarves.map((d) => ({
      ...d,
      need_food: Math.round(d.need_food),
      need_drink: Math.round(d.need_drink),
      need_sleep: Math.round(d.need_sleep),
      need_social: Math.round(d.need_social),
      need_purpose: 0,
      need_beauty: 0,
      stress_level: Math.round(d.stress_level),
      health: Math.round(d.health),
    }));
    const { error } = await supabase.from("dwarves").upsert(rounded);
    if (error) console.warn(`[flush] dwarves upsert failed: ${error.message}`);
  }

  // 5. Monsters
  if (dirtyMonsters.length > 0) {
    const { error } = await supabase.from("monsters").upsert(dirtyMonsters);
    if (error) console.warn(`[flush] monsters upsert failed: ${error.message}`);
  }

  // 6. Skills
  if (state.dirtyDwarfSkillIds.size > 0) {
    const dirtySkills = state.dwarfSkills.filter((s) =>
      state.dirtyDwarfSkillIds.has(s.id),
    );
    if (dirtySkills.length > 0) {
      const { error } = await supabase.from("dwarf_skills").upsert(dirtySkills);
      if (error) console.warn(`[flush] dwarf_skills upsert failed: ${error.message}`);
    }
  }

  // 7. Fortress tiles
  if (state.dirtyFortressTileKeys.size > 0) {
    const dirtyTiles = [...state.dirtyFortressTileKeys]
      .map((key) => state.fortressTileOverrides.get(key))
      .filter(Boolean);
    if (dirtyTiles.length > 0) {
      const { error } = await supabase
        .from("fortress_tiles")
        .upsert(dirtyTiles, { onConflict: "civilization_id,x,y,z" });
      if (error) console.warn(`[flush] fortress_tiles upsert failed: ${error.message}`);
    }
  }

  // 8. Relationships
  if (newRelationships.length > 0) {
    const { error } = await supabase.from("dwarf_relationships").insert(newRelationships);
    if (error) console.warn(`[flush] dwarf_relationships insert failed: ${error.message}`);
  }
  if (dirtyRelationships.length > 0) {
    const { error } = await supabase.from("dwarf_relationships").upsert(dirtyRelationships);
    if (error) console.warn(`[flush] dwarf_relationships upsert failed: ${error.message}`);
  }

  // 9. Civilization status
  if (state.civFallen) {
    {
      const { error } = await supabase
        .from("civilizations")
        .update({
          status: 'fallen',
          fallen_year: ctx.year,
          cause_of_death: state.civFallenCause,
          population: 0,
        })
        .eq("id", ctx.civilizationId);
      if (error) console.warn(`[flush] civilizations fallen update failed: ${error.message}`);
    }
    {
      const { error } = await supabase.from("ruins").insert({
        civilization_id: ctx.civilizationId,
        world_id: ctx.worldId,
        name: ctx.civName,
        tile_x: ctx.civTileX,
        tile_y: ctx.civTileY,
        fallen_year: ctx.year,
        cause_of_death: state.civFallenCause,
        peak_population: state.civPeakPopulation,
      });
      if (error) console.warn(`[flush] ruins insert failed: ${error.message}`);
    }
  } else if (state.civDirty) {
    const { error } = await supabase
      .from("civilizations")
      .update({ population: state.civPopulation, wealth: state.civWealth })
      .eq("id", ctx.civilizationId);
    if (error) console.warn(`[flush] civilizations update failed: ${error.message}`);
  }

  // 10. Expeditions
  if (state.dirtyExpeditionIds.size > 0) {
    const dirtyExpeditions = state.expeditions.filter(e => state.dirtyExpeditionIds.has(e.id));
    if (dirtyExpeditions.length > 0) {
      const { error } = await supabase.from("expeditions").upsert(dirtyExpeditions);
      if (error) console.warn(`[flush] expeditions upsert failed: ${error.message}`);
    }
  }

  // 11. Ruins
  if (state.dirtyRuinIds.size > 0) {
    const dirtyRuins = state.ruins.filter(r => state.dirtyRuinIds.has(r.id));
    if (dirtyRuins.length > 0) {
      const { error } = await supabase.from("ruins").upsert(dirtyRuins);
      if (error) console.warn(`[flush] ruins upsert failed: ${error.message}`);
    }
  }

  // 12. Events (last — least critical, immutable)
  if (events.length > 0) {
    const worldId = ctx.worldId;
    const stamped = events.map((e) => ({ ...e, world_id: worldId }));
    const seen = new Set<string>();
    const unique = stamped.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    if (unique.length > 0) {
      const { error } = await supabase.from("world_events").insert(unique);
      if (error && !error.message.includes('duplicate key')) {
        console.warn(`[flush] events insert failed: ${error.message}`);
      }
    }
  }

  // Clear dirty tracking
  state.dirtyDwarfIds.clear();
  state.dirtyItemIds.clear();
  state.dirtyStructureIds.clear();
  state.dirtyMonsterIds.clear();
  state.dirtyTaskIds.clear();
  state.dirtyDwarfSkillIds.clear();
  state.dirtyFortressTileKeys.clear();
  state.dirtyDwarfRelationshipIds.clear();
  state.dirtyExpeditionIds.clear();
  state.dirtyRuinIds.clear();
  state.newTasks = [];
  state.newDwarfRelationships = [];
  state.pendingEvents = [];
  state.civDirty = false;
}

/**
 * Fix dangling foreign key references before flushing to the database.
 *
 * Items can be created and consumed within a single flush window. Tasks
 * referencing those items via target_item_id will violate the FK constraint
 * when inserted. This function:
 *
 * 1. Builds a set of all live item + structure IDs (items in memory)
 * 2. Nulls out target_item_id on any task pointing to a deleted entity
 * 3. Removes new tasks that were created AND completed in the same window
 *    with a dangling item ref (no point inserting a completed eat task
 *    whose food is already gone)
 *
 * Exported for unit testing.
 */
export function sanitizeDanglingRefs(state: SimContext['state']): void {
  // Build lookup of all live item IDs and structure IDs
  const liveItemIds = new Set<string>();
  for (const item of state.items) {
    liveItemIds.add(item.id);
  }
  for (const structure of state.structures) {
    liveItemIds.add(structure.id);
  }

  // Fix dangling target_item_id on all tasks (dirty + new)
  for (const task of state.tasks) {
    if (task.target_item_id && !liveItemIds.has(task.target_item_id)) {
      task.target_item_id = null;
      state.dirtyTaskIds.add(task.id);
    }
  }

  // Drop new tasks that were created and already completed/failed with a
  // null target_item_id — they carry no useful information for the DB.
  // (e.g., an eat task where the food was consumed in the same flush window)
  state.newTasks = state.newTasks.filter((task) => {
    if (task.status === 'completed' || task.status === 'failed') {
      // If this task had a dangling ref that we just nulled, skip inserting it
      if (task.target_item_id === null) {
        // Check if there's a corresponding dirty entry — remove that too
        state.dirtyTaskIds.delete(task.id);
        return false;
      }
    }
    return true;
  });
}
