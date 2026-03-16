import type { SupabaseClient } from "@supabase/supabase-js";

/** Cached world-state slices that get loaded at start and updated incrementally. */
export interface CachedState {
  dwarves: unknown[];
  items: unknown[];
  structures: unknown[];
  monsters: unknown[];
  workOrders: unknown[];
  worldEvents: unknown[];
}

/**
 * The context object threaded through every simulation phase.
 * Holds the supabase client, civilization identity, time tracking,
 * and the mutable cached state that phases read from and write to.
 */
export interface SimContext {
  /** Authenticated Supabase client (service-role key). */
  supabase: SupabaseClient;

  /** The civilization this sim instance is driving. */
  civilizationId: string;

  /** Monotonically increasing step counter since sim start. */
  step: number;

  /** Current in-game year. */
  year: number;

  /** Current in-game day within the year. */
  day: number;

  /** Mutable cached world state, loaded at start and patched each tick. */
  state: CachedState;
}
