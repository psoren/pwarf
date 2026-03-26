import type { Task } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import type { CachedState } from "./sim-context.js";

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

  // Prune terminal tasks that were already flushed in a previous cycle
  // (not dirty = already persisted to DB, safe to remove from memory)
  pruneTerminalTasks(state);

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

  // ── Swap dirty sets before the async RPC ──────────────────────────────
  // Ticks continue running during the RPC call below. By swapping the
  // dirty sets for fresh empty ones NOW, any entities dirtied during the
  // await window will land in the new sets and survive for the next flush.
  // On RPC failure, the old IDs are merged back into the live sets.
  const prevDirtyDwarfIds = state.dirtyDwarfIds;
  const prevDirtyItemIds = state.dirtyItemIds;
  const prevDirtyStructureIds = state.dirtyStructureIds;
  const prevDirtyMonsterIds = state.dirtyMonsterIds;
  const prevDirtyTaskIds = state.dirtyTaskIds;
  const prevDirtySkillIds = state.dirtyDwarfSkillIds;
  const prevDirtyTileKeys = state.dirtyFortressTileKeys;
  const prevDirtyRelIds = state.dirtyDwarfRelationshipIds;
  const prevDirtyRuinIds = state.dirtyRuinIds;
  const prevNewTasks = state.newTasks;
  const prevNewRels = state.newDwarfRelationships;
  const prevEvents = state.pendingEvents;
  const prevCivDirty = state.civDirty;

  state.dirtyDwarfIds = new Set();
  state.dirtyItemIds = new Set();
  state.dirtyStructureIds = new Set();
  state.dirtyMonsterIds = new Set();
  state.dirtyTaskIds = new Set();
  state.dirtyDwarfSkillIds = new Set();
  state.dirtyFortressTileKeys = new Set();
  state.dirtyDwarfRelationshipIds = new Set();
  state.dirtyRuinIds = new Set();
  state.newTasks = [];
  state.newDwarfRelationships = [];
  state.pendingEvents = [];
  state.civDirty = false;

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
    // Merge the pre-swap dirty IDs back so they're retried next cycle.
    for (const id of prevDirtyDwarfIds) state.dirtyDwarfIds.add(id);
    for (const id of prevDirtyItemIds) state.dirtyItemIds.add(id);
    for (const id of prevDirtyStructureIds) state.dirtyStructureIds.add(id);
    for (const id of prevDirtyMonsterIds) state.dirtyMonsterIds.add(id);
    for (const id of prevDirtyTaskIds) state.dirtyTaskIds.add(id);
    for (const id of prevDirtySkillIds) state.dirtyDwarfSkillIds.add(id);
    for (const key of prevDirtyTileKeys) state.dirtyFortressTileKeys.add(key);
    for (const id of prevDirtyRelIds) state.dirtyDwarfRelationshipIds.add(id);
    for (const id of prevDirtyRuinIds) state.dirtyRuinIds.add(id);
    state.newTasks.push(...prevNewTasks);
    state.newDwarfRelationships.push(...prevNewRels);
    state.pendingEvents.push(...prevEvents);
    state.civDirty = state.civDirty || prevCivDirty;
    return;
  }

  // No clearing needed here — dirty sets were swapped for fresh empties
  // before the RPC. Any modifications during the await landed in the new
  // sets and will be picked up by the next flush cycle.
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

const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['completed', 'cancelled', 'failed']);

/**
 * Remove terminal tasks from state.tasks to prevent unbounded growth.
 * Tasks referenced by a live dwarf's current_task_id are preserved.
 * Exported for unit testing.
 */
export function pruneTerminalTasks(state: CachedState): void {
  const referencedTaskIds = new Set<string>();
  for (const d of state.dwarves) {
    if (d.current_task_id) referencedTaskIds.add(d.current_task_id);
  }

  // Also keep newTasks IDs — they haven't been flushed yet
  const newTaskIds = new Set(state.newTasks.map(t => t.id));

  state.tasks = state.tasks.filter(t => {
    if (!TERMINAL_STATUSES.has(t.status)) return true;
    if (referencedTaskIds.has(t.id)) return true;
    // Keep tasks that are dirty (status changed this tick) or newly created
    if (state.dirtyTaskIds.has(t.id)) return true;
    if (newTaskIds.has(t.id)) return true;
    return false;
  });

  // Rebuild the task ID index after pruning
  state.taskById.clear();
  for (const t of state.tasks) state.taskById.set(t.id, t);
}
