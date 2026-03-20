import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockpileTile, WorldEvent } from "@pwarf/shared";
import { WORLD_EVENTS_RECENT_LIMIT } from "@pwarf/shared";
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
  const [dwarvesResult, itemsResult, structuresResult, monstersResult, tasksResult, skillsResult, stockpileResult, eventsResult] =
    await Promise.all([
      supabase
        .from("dwarves")
        .select("*")
        .eq("civilization_id", civilizationId)
        .eq("status", "alive"),
      supabase
        .from("items")
        .select("*")
        .or(`located_in_civ_id.eq.${civilizationId},created_in_civ_id.eq.${civilizationId}`),
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
      supabase
        .from("stockpile_tiles")
        .select("*")
        .eq("civilization_id", civilizationId),
      supabase
        .from("world_events")
        .select("*")
        .eq("civilization_id", civilizationId)
        .order("created_at", { ascending: false })
        .limit(WORLD_EVENTS_RECENT_LIMIT),
    ]);

  if (dwarvesResult.error) throw new Error(`Failed to load dwarves: ${dwarvesResult.error.message}`);
  if (itemsResult.error) throw new Error(`Failed to load items: ${itemsResult.error.message}`);
  if (structuresResult.error) throw new Error(`Failed to load structures: ${structuresResult.error.message}`);
  if (monstersResult.error) throw new Error(`Failed to load monsters: ${monstersResult.error.message}`);
  if (tasksResult.error) throw new Error(`Failed to load tasks: ${tasksResult.error.message}`);
  if (stockpileResult.error) throw new Error(`Failed to load stockpile_tiles: ${stockpileResult.error.message}`);
  if (eventsResult.error) console.warn(`[load-state] Failed to load world_events: ${eventsResult.error.message}`);

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

  // Build stockpile tile map
  const stockpileTiles = new Map<string, StockpileTile>();
  for (const st of (stockpileResult.data ?? []) as StockpileTile[]) {
    stockpileTiles.set(`${st.x},${st.y},${st.z}`, st);
  }

  return {
    dwarves: dwarvesResult.data ?? [],
    items: itemsResult.data ?? [],
    structures: structuresResult.data ?? [],
    monsters: monstersResult.data ?? [],
    tasks: tasksResult.data ?? [],
    dwarfSkills: dwarfSkills as never[],
    worldEvents: (eventsResult.data ?? []) as WorldEvent[],
    dirtyDwarfIds: new Set(),
    dirtyItemIds: new Set(),
    dirtyStructureIds: new Set(),
    dirtyMonsterIds: new Set(),
    dirtyTaskIds: new Set(),
    dirtyDwarfSkillIds: new Set(),
    newTasks: [],
    pendingEvents: [],
    stockpileTiles,
    fortressTileOverrides: new Map(),
    dirtyFortressTileKeys: new Set(),
    zeroFoodTicks: new Map(),
    zeroDrinkTicks: new Map(),
    tantrumTicks: new Map(),
    warnedNeedIds: new Map(),
  };
}
