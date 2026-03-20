import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensurePlayer(
  client: SupabaseClient,
  userId: string,
  email: string | undefined,
): Promise<void> {
  const { data } = await client
    .from("players")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!data) {
    const username = email ? email.split("@")[0] : `anon-${userId.slice(0, 8)}`;
    const { error } = await client
      .from("players")
      .insert({ id: userId, username });
    if (error) throw error;
  }
}
