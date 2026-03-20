import type { SimContext } from "./sim-context.js";

/**
 * Flush dirty entities and pending events to Supabase.
 *
 * All flushes run in parallel via Promise.all. Errors are
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
  const dirtyTasks = state.tasks.filter((t) => state.dirtyTaskIds.has(t.id));
  const newTasks = [...state.newTasks];
  const events = [...state.pendingEvents];
  const newRelationships = [...state.newDwarfRelationships];
  const dirtyRelationships = state.dwarfRelationships.filter((r) =>
    state.dirtyDwarfRelationshipIds.has(r.id),
  );

  // Flush tasks BEFORE dwarves — dwarves.current_task_id has a FK to tasks,
  // so the referenced task row must exist first.
  if (newTasks.length > 0) {
    const { error } = await supabase.from("tasks").insert(newTasks);
    if (error) console.warn(`[flush] tasks insert failed: ${error.message}`);
  }

  if (dirtyTasks.length > 0) {
    const { error } = await supabase.from("tasks").upsert(dirtyTasks);
    if (error) console.warn(`[flush] tasks upsert failed: ${error.message}`);
  }

  // Now flush everything else in parallel
  const promises: PromiseLike<void>[] = [];

  if (dirtyDwarves.length > 0) {
    // Round need values — DB columns are integer, sim computes fractional decay
    const rounded = dirtyDwarves.map((d) => ({
      ...d,
      need_food: Math.round(d.need_food),
      need_drink: Math.round(d.need_drink),
      need_sleep: Math.round(d.need_sleep),
      need_social: Math.round(d.need_social),
      need_purpose: Math.round(d.need_purpose),
      need_beauty: Math.round(d.need_beauty),
      stress_level: Math.round(d.stress_level),
      health: Math.round(d.health),
    }));
    promises.push(
      supabase
        .from("dwarves")
        .upsert(rounded)
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

  if (state.dirtyDwarfSkillIds.size > 0) {
    const dirtySkills = state.dwarfSkills.filter((s) =>
      state.dirtyDwarfSkillIds.has(s.id),
    );
    if (dirtySkills.length > 0) {
      promises.push(
        supabase
          .from("dwarf_skills")
          .upsert(dirtySkills)
          .then(({ error }) => {
            if (error) console.warn(`[flush] dwarf_skills upsert failed: ${error.message}`);
          }),
      );
    }
  }

  if (state.dirtyFortressTileKeys.size > 0) {
    const dirtyTiles = [...state.dirtyFortressTileKeys]
      .map((key) => state.fortressTileOverrides.get(key))
      .filter(Boolean);
    if (dirtyTiles.length > 0) {
      promises.push(
        supabase
          .from("fortress_tiles")
          .upsert(dirtyTiles, { onConflict: "civilization_id,x,y,z" })
          .then(({ error }) => {
            if (error) console.warn(`[flush] fortress_tiles upsert failed: ${error.message}`);
          }),
      );
    }
  }

  if (newRelationships.length > 0) {
    promises.push(
      supabase
        .from("dwarf_relationships")
        .insert(newRelationships)
        .then(({ error }) => {
          if (error) console.warn(`[flush] dwarf_relationships insert failed: ${error.message}`);
        }),
    );
  }

  if (dirtyRelationships.length > 0) {
    promises.push(
      supabase
        .from("dwarf_relationships")
        .upsert(dirtyRelationships)
        .then(({ error }) => {
          if (error) console.warn(`[flush] dwarf_relationships upsert failed: ${error.message}`);
        }),
    );
  }

  if (state.civDirty) {
    promises.push(
      supabase
        .from("civilizations")
        .update({ population: state.civPopulation, wealth: state.civWealth })
        .eq("id", ctx.civilizationId)
        .then(({ error }) => {
          if (error) console.warn(`[flush] civilizations update failed: ${error.message}`);
        }),
    );
  }

  if (events.length > 0) {
    // Stamp world_id on events (phases leave it empty)
    const worldId = ctx.worldId;
    const stamped = events.map((e) => ({ ...e, world_id: worldId }));
    promises.push(
      supabase
        .from("world_events")
        .insert(stamped)
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
  state.dirtyTaskIds.clear();
  state.dirtyDwarfSkillIds.clear();
  state.dirtyFortressTileKeys.clear();
  state.dirtyDwarfRelationshipIds.clear();
  state.newTasks = [];
  state.newDwarfRelationships = [];
  state.pendingEvents = [];
  state.civDirty = false;
}
