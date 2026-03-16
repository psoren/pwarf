import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dwarf, Item, Structure, Monster } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";

/**
 * Load the full cached state for a civilization from Supabase.
 *
 * Queries dwarves, items, structures, and monsters in parallel,
 * returning a CachedState ready for the simulation loop.
 *
 * @param supabase  - Authenticated Supabase client (service-role key)
 * @param civilizationId - The civilization to load state for
 * @param worldId - The world the civilization belongs to (used for monster queries)
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

  if (dwarvesResult.error) {
    throw new Error(
      `Failed to load dwarves for civilization ${civilizationId}: ${dwarvesResult.error.message}`,
    );
  }
  if (itemsResult.error) {
    throw new Error(
      `Failed to load items for civilization ${civilizationId}: ${itemsResult.error.message}`,
    );
  }
  if (structuresResult.error) {
    throw new Error(
      `Failed to load structures for civilization ${civilizationId}: ${structuresResult.error.message}`,
    );
  }
  if (monstersResult.error) {
    throw new Error(
      `Failed to load monsters for world ${worldId}: ${monstersResult.error.message}`,
    );
  }

  return {
    dwarves: dwarvesResult.data as Dwarf[],
    items: itemsResult.data as Item[],
    structures: structuresResult.data as Structure[],
    monsters: monstersResult.data as Monster[],
    workOrders: [],
    worldEvents: [],
    dirtyDwarfIds: new Set(),
    dirtyItemIds: new Set(),
    dirtyStructureIds: new Set(),
    dirtyMonsterIds: new Set(),
    pendingEvents: [],
  };
}
