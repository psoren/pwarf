import { supabase } from "./supabase";

export interface GameSession {
  worldId: string | null;
  worldSeed: bigint | null;
  civId: string | null;
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
  if (!worldId) return { worldId: null, worldSeed: null, civId: null };

  // Fetch world seed and active civilization in parallel
  const [worldResult, civResult] = await Promise.all([
    supabase.from("worlds").select("seed").eq("id", worldId).single(),
    supabase
      .from("civilizations")
      .select("id")
      .eq("world_id", worldId)
      .eq("player_id", userId)
      .eq("status", "active")
      .limit(1)
      .single(),
  ]);

  const worldSeed = worldResult.data?.seed != null
    ? BigInt(worldResult.data.seed)
    : null;

  return { worldId, worldSeed, civId: civResult.data?.id ?? null };
}
