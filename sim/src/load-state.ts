import type { SupabaseClient } from "@supabase/supabase-js";
import type { CachedState } from "./sim-context.js";

/**
 * Load the current world state from Supabase into a CachedState.
 *
 * Queries dwarves, items, structures, and monsters in parallel.
 * worldEvents and workOrders start empty — events are generated
 * during simulation, and work orders will be loaded separately.
 */
export async function loadStateFromSupabase(
  supabase: SupabaseClient,
  civilizationId: string,
  worldId: string,
): Promise<CachedState> {
  const [dwarvesResult, itemsResult, structuresResult, monstersResult] =
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
    ]);

  if (dwarvesResult.error) throw new Error(`Failed to load dwarves: ${dwarvesResult.error.message}`);
  if (itemsResult.error) throw new Error(`Failed to load items: ${itemsResult.error.message}`);
  if (structuresResult.error) throw new Error(`Failed to load structures: ${structuresResult.error.message}`);
  if (monstersResult.error) throw new Error(`Failed to load monsters: ${monstersResult.error.message}`);

  return {
    dwarves: dwarvesResult.data ?? [],
    items: itemsResult.data ?? [],
    structures: structuresResult.data ?? [],
    monsters: monstersResult.data ?? [],
    workOrders: [],
    worldEvents: [],
    dirtyDwarfIds: new Set(),
    dirtyItemIds: new Set(),
    dirtyStructureIds: new Set(),
    dirtyMonsterIds: new Set(),
    pendingEvents: [],
  };
}
