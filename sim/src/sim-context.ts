import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Dwarf,
  DwarfSkill,
  Item,
  Structure,
  Monster,
  WorldEvent,
  Task,
} from "@pwarf/shared";

/** Cached world-state slices that get loaded at start and updated incrementally. */
export interface CachedState {
  dwarves: Dwarf[];
  items: Item[];
  structures: Structure[];
  monsters: Monster[];
  tasks: Task[];
  dwarfSkills: DwarfSkill[];
  worldEvents: WorldEvent[];

  /** IDs of entities modified during the current tick, to be flushed to DB. */
  dirtyDwarfIds: Set<string>;
  dirtyItemIds: Set<string>;
  dirtyStructureIds: Set<string>;
  dirtyMonsterIds: Set<string>;
  dirtyTaskIds: Set<string>;

  /** New tasks created this tick that need to be inserted (not upserted). */
  newTasks: Task[];

  /** Events queued during a tick, flushed by the event-firing phase. */
  pendingEvents: WorldEvent[];

  /** Tracks ticks at zero need for starvation/dehydration death. */
  zeroFoodTicks: Map<string, number>;
  zeroDrinkTicks: Map<string, number>;
}

/** Returns a fresh CachedState with empty arrays and sets. */
export function createEmptyCachedState(): CachedState {
  return {
    dwarves: [],
    items: [],
    structures: [],
    monsters: [],
    tasks: [],
    dwarfSkills: [],
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

  /** The world this civilization belongs to. */
  worldId: string;

  /** Monotonically increasing step counter since sim start. */
  step: number;

  /** Current in-game year. */
  year: number;

  /** Current in-game day within the year. */
  day: number;

  /** Mutable cached world state, loaded at start and patched each tick. */
  state: CachedState;
}
