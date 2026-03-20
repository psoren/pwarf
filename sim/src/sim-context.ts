import type { SupabaseClient } from "@supabase/supabase-js";
import { createRng, DEFAULT_TEST_SEED, type Rng } from "./rng.js";
import type {
  Dwarf,
  DwarfSkill,
  FortressDeriver,
  FortressTile,
  Item,
  StockpileTile,
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
  dirtyDwarfSkillIds: Set<string>;

  /** New tasks created this tick that need to be inserted (not upserted). */
  newTasks: Task[];

  /** Events queued during a tick, flushed by the event-firing phase. */
  pendingEvents: WorldEvent[];

  /** Stockpile tiles keyed by "x,y,z". */
  stockpileTiles: Map<string, StockpileTile>;

  /** Fortress tile overrides created by mining/building. Keyed by "x,y,z". */
  fortressTileOverrides: Map<string, FortressTile>;
  dirtyFortressTileKeys: Set<string>;

  /** Tracks ticks at zero need for starvation/dehydration death. */
  zeroFoodTicks: Map<string, number>;
  zeroDrinkTicks: Map<string, number>;

  /** Tracks remaining tantrum ticks per dwarf. Entry removed when tantrum ends. */
  tantrumTicks: Map<string, number>;

  /** IDs of dwarves currently infected with disease. Cleared on death or recovery. */
  infectedDwarfIds: Set<string>;

  /**
   * Tracks which (dwarf, need) pairs have already fired a critical-need warning
   * this crossing. Maps dwarfId → Set of need names ('food' | 'drink').
   * Cleared when the need recovers above the warning threshold.
   */
  warnedNeedIds: Map<string, Set<string>>;
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
    dirtyDwarfSkillIds: new Set(),
    newTasks: [],
    pendingEvents: [],
    stockpileTiles: new Map(),
    fortressTileOverrides: new Map(),
    dirtyFortressTileKeys: new Set(),
    zeroFoodTicks: new Map(),
    zeroDrinkTicks: new Map(),
    tantrumTicks: new Map(),
    infectedDwarfIds: new Set(),
    warnedNeedIds: new Map(),
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

  /** Fortress tile deriver for looking up procedurally generated tile types. */
  fortressDeriver: FortressDeriver | null;

  /** Monotonically increasing step counter since sim start. */
  step: number;

  /** Current in-game year. */
  year: number;

  /** Current in-game day within the year. */
  day: number;

  /** Seeded RNG — use instead of Math.random() or crypto.randomUUID(). */
  rng: Rng;

  /** Mutable cached world state, loaded at start and patched each tick. */
  state: CachedState;
}

/** Creates a SimContext with a default test seed. Used in tests. */
export function createTestContext(
  opts?: {
    dwarves?: Dwarf[];
    skills?: DwarfSkill[];
    tasks?: Task[];
    items?: Item[];
    structures?: Structure[];
  },
  seed = DEFAULT_TEST_SEED
): SimContext {
  const state = createEmptyCachedState();
  state.dwarves = opts?.dwarves ?? [];
  state.dwarfSkills = opts?.skills ?? [];
  state.tasks = opts?.tasks ?? [];
  state.items = opts?.items ?? [];
  state.structures = opts?.structures ?? [];

  return {
    supabase: null as unknown as SupabaseClient,
    civilizationId: "civ-1",
    worldId: "world-1",
    fortressDeriver: null,
    step: 0,
    year: 1,
    day: 1,
    rng: createRng(seed),
    state,
  };
}

export { createRng, DEFAULT_TEST_SEED };
export type { Rng };
