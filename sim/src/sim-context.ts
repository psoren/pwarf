import type { SupabaseClient } from "@supabase/supabase-js";
import { createRng, DEFAULT_TEST_SEED, type Rng } from "./rng.js";
import type {
  Dwarf,
  DwarfRelationship,
  DwarfSkill,
  Expedition,
  FortressDeriver,
  FortressTile,
  Item,
  ItemCategory,
  ItemQuality,
  Ruin,
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
  dwarfRelationships: DwarfRelationship[];
  worldEvents: WorldEvent[];

  /** IDs of entities modified during the current tick, to be flushed to DB. */
  dirtyDwarfIds: Set<string>;
  dirtyItemIds: Set<string>;
  dirtyStructureIds: Set<string>;
  dirtyMonsterIds: Set<string>;
  dirtyTaskIds: Set<string>;
  dirtyDwarfSkillIds: Set<string>;
  dirtyDwarfRelationshipIds: Set<string>;

  /** New tasks created this tick that need to be inserted (not upserted). */
  newTasks: Task[];

  /** New relationships created that need to be inserted (not upserted). */
  newDwarfRelationships: DwarfRelationship[];

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
   * IDs of dead dwarves whose spirits have not yet been put to rest.
   * Ghosts haunt the fortress and stress nearby living dwarves.
   * Cleared when an engrave_memorial task is completed nearby.
   * Note: only tracks ghosts from the current session (dead dwarves from prior
   * sessions are not loaded — this is an acceptable simplification for now).
   */
  ghostDwarfIds: Set<string>;

  /**
   * Tracks which (dwarf, need) pairs have already fired a critical-need warning
   * this crossing. Maps dwarfId → Set of need names ('food' | 'drink').
   * Cleared when the need recovers above the warning threshold.
   */
  warnedNeedIds: Map<string, Set<string>>;

  /**
   * IDs of dwarves currently in a strange mood (creating an artifact).
   * These dwarves skip haunting stress and cannot be assigned other tasks.
   * In-memory only; not persisted across sim restarts.
   */
  strangeMoodDwarfIds: Set<string>;

  /** Cached civilization population, updated each yearly rollup. */
  civPopulation: number;

  /** Cached civilization wealth (sum of located item values), updated each yearly rollup. */
  civWealth: number;

  /** Whether civPopulation or civWealth changed this year and need flushing. */
  civDirty: boolean;

  /**
   * Set to true when the last dwarf dies. Triggers flush of `civilizations.status = 'fallen'`
   * and stops the sim runner after the next flush cycle.
   */
  civFallen: boolean;

  /** Cause of death to record on the civilization row when civFallen becomes true. */
  civFallenCause: string;

  /** High-water mark of live population — recorded on the ruin row when the fortress falls. */
  civPeakPopulation: number;

  /**
   * Tracks active combat engagements as "${monsterId}:${dwarfId}" pairs.
   * A battle world event is fired once per pair on first contact.
   * Cleared when the monster is slain or the dwarf dies.
   * In-memory only; not persisted across sim restarts.
   */
  activeCombatPairs: Set<string>;

  /** Active expeditions (not complete or lost). */
  expeditions: Expedition[];
  dirtyExpeditionIds: Set<string>;

  /** Ruins in the world. */
  ruins: Ruin[];
  dirtyRuinIds: Set<string>;

  /**
   * In-memory loot pending return from expedition. Keyed by expedition ID.
   * Not persisted — if the sim restarts mid-expedition, loot is lost.
   */
  _pendingExpeditionLoot: Map<string, Array<{ category: ItemCategory; material: string; quality: ItemQuality }>>;
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
    dwarfRelationships: [],
    worldEvents: [],
    dirtyDwarfIds: new Set(),
    dirtyItemIds: new Set(),
    dirtyStructureIds: new Set(),
    dirtyMonsterIds: new Set(),
    dirtyTaskIds: new Set(),
    dirtyDwarfSkillIds: new Set(),
    dirtyDwarfRelationshipIds: new Set(),
    newTasks: [],
    newDwarfRelationships: [],
    pendingEvents: [],
    stockpileTiles: new Map(),
    fortressTileOverrides: new Map(),
    dirtyFortressTileKeys: new Set(),
    zeroFoodTicks: new Map(),
    zeroDrinkTicks: new Map(),
    tantrumTicks: new Map(),
    infectedDwarfIds: new Set(),
    ghostDwarfIds: new Set(),
    strangeMoodDwarfIds: new Set(),
    warnedNeedIds: new Map(),
    civPopulation: 0,
    civWealth: 0,
    civDirty: false,
    civFallen: false,
    civFallenCause: 'unknown',
    civPeakPopulation: 0,
    activeCombatPairs: new Set(),
    expeditions: [],
    dirtyExpeditionIds: new Set(),
    ruins: [],
    dirtyRuinIds: new Set(),
    _pendingExpeditionLoot: new Map(),
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

  /** The civilization's name (used when creating the ruin record on fall). */
  civName: string;

  /** World-map tile coordinates of the embark site. */
  civTileX: number;
  civTileY: number;

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
    civName: "Test Fortress",
    civTileX: 0,
    civTileY: 0,
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
