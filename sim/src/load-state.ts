import type { SupabaseClient } from "@supabase/supabase-js";
import type { CachedState } from "./sim-context.js";

/**
 * Load the current world state from Supabase into a CachedState.
 *
 * Queries dwarves, items, structures, monsters, and active tasks in parallel.
 */
export async function loadStateFromSupabase(
  supabase: SupabaseClient,
  civilizationId: string,
  worldId: string,
): Promise<CachedState> {
  const [dwarvesResult, itemsResult, structuresResult, monstersResult, tasksResult, skillsResult] =
    await Promise.all([
      supabase
        .from("dwarves")
        .select("*")
        .eq("civilization_id", civilizationId)
        .eq("status", "alive"),
      supabase
        .from("items")
        .select("*")
        .eq("located_in_civ_id", civilizationId),
      supabase
        .from("structures")
        .select("*")
        .eq("civilization_id", civilizationId),
      supabase
        .from("monsters")
        .select("*")
        .eq("world_id", worldId)
        .eq("status", "active"),
      supabase
        .from("tasks")
        .select("*")
        .eq("civilization_id", civilizationId)
        .in("status", ["pending", "claimed", "in_progress"]),
      supabase
        .from("dwarf_skills")
        .select("*")
        .in("dwarf_id", []),  // Will be populated after dwarves load
    ]);

  if (dwarvesResult.error) throw new Error(`Failed to load dwarves: ${dwarvesResult.error.message}`);
  if (itemsResult.error) throw new Error(`Failed to load items: ${itemsResult.error.message}`);
  if (structuresResult.error) throw new Error(`Failed to load structures: ${structuresResult.error.message}`);
  if (monstersResult.error) throw new Error(`Failed to load monsters: ${monstersResult.error.message}`);
  if (tasksResult.error) throw new Error(`Failed to load tasks: ${tasksResult.error.message}`);

  // Load skills for the alive dwarves
  const dwarfIds = (dwarvesResult.data ?? []).map(d => d.id);
  let dwarfSkills: Array<Record<string, unknown>> = [];
  if (dwarfIds.length > 0) {
    const { data, error } = await supabase
      .from("dwarf_skills")
      .select("*")
      .in("dwarf_id", dwarfIds);
    if (error) throw new Error(`Failed to load dwarf_skills: ${error.message}`);
    dwarfSkills = data ?? [];
  }

  return {
    dwarves: dwarvesResult.data ?? [],
    items: itemsResult.data ?? [],
    structures: structuresResult.data ?? [],
    monsters: monstersResult.data ?? [],
    tasks: tasksResult.data ?? [],
    dwarfSkills: dwarfSkills as never[],
    worldEvents: [],
    dirtyDwarfIds: new Set(),
    dirtyItemIds: new Set(),
    dirtyStructureIds: new Set(),
    dirtyMonsterIds: new Set(),
    dirtyTaskIds: new Set(),
    newTasks: [],
    pendingEvents: [],
    zeroFoodTicks: new Map(),
    zeroDrinkTicks: new Map(),
  };
}
