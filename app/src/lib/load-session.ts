import type { TerrainType } from "@pwarf/shared";
import { supabase } from "./supabase";

export interface GameSession {
  worldId: string | null;
  worldSeed: bigint | null;
  civId: string | null;
  fortressX: number | null;
  fortressY: number | null;
  embarkTerrain: TerrainType | null;
}

/**
 * Load an existing game session for the current user.
 * Reads the player's world_id, fetches the world seed, and looks up their active civilization.
 */
export async function loadSession(userId: string): Promise<GameSession> {
  const { data: player } = await supabase
    .from("players")
    .select("world_id")
    .eq("id", userId)
    .single();

  const worldId = player?.world_id ?? null;
  if (!worldId) return { worldId: null, worldSeed: null, civId: null, fortressX: null, fortressY: null, embarkTerrain: null };

  // Fetch world seed and active civilization in parallel
  const [worldResult, civResult] = await Promise.all([
    supabase.from("worlds").select("seed").eq("id", worldId).single(),
    supabase
      .from("civilizations")
      .select("id, tile_x, tile_y")
      .eq("world_id", worldId)
      .eq("player_id", userId)
      .eq("status", "active")
      .limit(1)
      .single(),
  ]);

  const worldSeed = worldResult.data?.seed != null
    ? BigInt(worldResult.data.seed)
    : null;

  const tileX = civResult.data?.tile_x ?? null;
  const tileY = civResult.data?.tile_y ?? null;

  // Fetch embark tile terrain
  let embarkTerrain: TerrainType | null = null;
  if (tileX != null && tileY != null) {
    const { data: tile } = await supabase
      .from("world_tiles")
      .select("terrain")
      .eq("world_id", worldId)
      .eq("x", tileX)
      .eq("y", tileY)
      .single();
    embarkTerrain = (tile?.terrain as TerrainType) ?? null;
  }

  return {
    worldId,
    worldSeed,
    civId: civResult.data?.id ?? null,
    fortressX: tileX,
    fortressY: tileY,
    embarkTerrain,
  };
}
