import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensurePlayer(
  client: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const { data } = await client
    .from("players")
    .select("id")
    .eq("id", userId)
    .single();

  if (!data) {
    const username = email.split("@")[0];
    const { error } = await client
      .from("players")
      .insert({ id: userId, username });
    if (error) throw error;
  }
}
