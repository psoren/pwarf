import type { Task } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";

/** Guard against overlapping flushes. */
let flushInProgress = false;

/**
 * Flush all dirty sim state to Supabase in a single RPC call.
 *
 * Uses the `flush_state` Postgres function which runs everything in one
 * transaction — atomic, FK-safe, and only one HTTP round-trip (eliminates
 * auth-lock contention from parallel REST calls).
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

  // Pre-flush cleanup: fix dangling foreign keys
  sanitizeDanglingRefs(state);

  // ── Collect all dirty entities ──────────────────────────────────────────

  const dirtyItems = state.items.filter((i) => state.dirtyItemIds.has(i.id));
  const dirtyStructures = state.structures.filter((s) =>
    state.dirtyStructureIds.has(s.id),
  );
  const dirtyMonsters = state.monsters.filter((m) =>
    state.dirtyMonsterIds.has(m.id),
  );

  // Deduplicate tasks (a task can appear in both newTasks and dirtyTasks)
  const taskById = new Map<string, Task>();
  for (const t of state.newTasks) taskById.set(t.id, t);
  for (const t of state.tasks) {
    if (state.dirtyTaskIds.has(t.id)) taskById.set(t.id, t);
  }
  const allTasks = [...taskById.values()];

  // Round dwarf need values (DB columns are integer)
  const dirtyDwarves = state.dwarves
    .filter((d) => state.dirtyDwarfIds.has(d.id))
    .map((d) => ({
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

  const dirtySkills = state.dirtyDwarfSkillIds.size > 0
    ? state.dwarfSkills.filter((s) => state.dirtyDwarfSkillIds.has(s.id))
    : [];

  const dirtyTiles = state.dirtyFortressTileKeys.size > 0
    ? [...state.dirtyFortressTileKeys]
        .map((key) => state.fortressTileOverrides.get(key))
        .filter(Boolean)
    : [];

  const newRelationships = [...state.newDwarfRelationships];
  const dirtyRelationships = state.dwarfRelationships.filter((r) =>
    state.dirtyDwarfRelationshipIds.has(r.id),
  );

  // Stamp world_id on events and deduplicate
  const worldId = ctx.worldId;
  const eventSeen = new Set<string>();
  const events = state.pendingEvents
    .map((e) => ({ ...e, world_id: worldId }))
    .filter((e) => {
      if (eventSeen.has(e.id)) return false;
      eventSeen.add(e.id);
      return true;
    });

  const dirtyRuins = state.dirtyRuinIds.size > 0
    ? state.ruins.filter((r) => state.dirtyRuinIds.has(r.id))
    : [];

  // Skip flush if nothing is dirty
  const hasDirty = dirtyItems.length > 0 || dirtyStructures.length > 0
    || allTasks.length > 0 || dirtyDwarves.length > 0
    || dirtyMonsters.length > 0 || dirtySkills.length > 0
    || dirtyTiles.length > 0 || newRelationships.length > 0
    || dirtyRelationships.length > 0 || events.length > 0
    || dirtyRuins.length > 0
    || state.civFallen || state.civDirty;

  if (!hasDirty) return;

  // ── Single RPC call ─────────────────────────────────────────────────────

  // Build ruin payload for civ-fall
  let newRuin: Record<string, unknown> | null = null;
  if (state.civFallen) {
    newRuin = {
      civilization_id: ctx.civilizationId,
      world_id: ctx.worldId,
      name: ctx.civName,
      tile_x: ctx.civTileX,
      tile_y: ctx.civTileY,
      fallen_year: ctx.year,
      cause_of_death: state.civFallenCause,
      peak_population: state.civPeakPopulation,
    };
  }

  const { error } = await supabase.rpc('flush_state', {
    p_items: dirtyItems,
    p_structures: dirtyStructures,
    p_tasks: allTasks,
    p_dwarves: dirtyDwarves,
    p_monsters: dirtyMonsters,
    p_dwarf_skills: dirtySkills,
    p_fortress_tiles: dirtyTiles,
    p_new_relationships: newRelationships,
    p_dirty_relationships: dirtyRelationships,
    p_events: events,
    p_ruins: dirtyRuins,
    p_civ_id: ctx.civilizationId,
    p_civ_fallen: state.civFallen,
    p_civ_fallen_year: state.civFallen ? ctx.year : null,
    p_civ_cause: state.civFallenCause ?? null,
    p_civ_population: state.civPopulation ?? null,
    p_civ_wealth: state.civWealth ?? null,
    p_civ_dirty: state.civDirty,
    p_new_ruin: newRuin,
  });

  if (error) {
    console.warn(`[flush] rpc flush_state failed: ${error.message}`);
    return; // Don't clear dirty tracking on failure — retry next cycle
  }

  // Clear dirty tracking after successful flush
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
 * Exported for unit testing.
 */
export function sanitizeDanglingRefs(state: SimContext['state']): void {
  const liveItemIds = new Set<string>();
  for (const item of state.items) liveItemIds.add(item.id);
  for (const structure of state.structures) liveItemIds.add(structure.id);

  for (const task of state.tasks) {
    if (task.target_item_id && !liveItemIds.has(task.target_item_id)) {
      task.target_item_id = null;
      state.dirtyTaskIds.add(task.id);
    }
  }

  state.newTasks = state.newTasks.filter((task) => {
    if ((task.status === 'completed' || task.status === 'failed') && task.target_item_id === null) {
      state.dirtyTaskIds.delete(task.id);
      return false;
    }
    return true;
  });
}
