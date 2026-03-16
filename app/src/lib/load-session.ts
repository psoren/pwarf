import { supabase } from "./supabase";

export interface GameSession {
  worldId: string | null;
  civId: string | null;
}

/**
 * Load an existing game session for the current user.
 * Reads the player's world_id and looks up their active civilization.
 */
export async function loadSession(userId: string): Promise<GameSession> {
  const { data: player } = await supabase
    .from("players")
    .select("world_id")
    .eq("id", userId)
    .single();

  const worldId = player?.world_id ?? null;
  if (!worldId) return { worldId: null, civId: null };

  const { data: civ } = await supabase
    .from("civilizations")
    .select("id")
    .eq("world_id", worldId)
    .eq("player_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();

  return { worldId, civId: civ?.id ?? null };
}
