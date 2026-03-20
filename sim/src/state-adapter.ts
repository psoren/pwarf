import type { Task, StockpileTile } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { loadStateFromSupabase } from "./load-state.js";
import type { SimContext } from "./sim-context.js";

/**
 * Abstracts all persistence operations from the sim.
 * Swap implementations to run against Supabase or fully in-memory.
 */
export interface StateAdapter {
  /** Load initial world state for a civilization. */
  loadState(civilizationId: string, worldId: string): Promise<CachedState>;

  /** Get the seed for a world (used to create FortressDeriver). */
  getWorldSeed(worldId: string): Promise<bigint | null>;

  /** Return any new tasks created externally (player designations) since last poll. */
  pollNewTasks(civilizationId: string, existingTaskIds: Set<string>): Promise<Task[]>;

  /** Return current stockpile tiles for a civilization. */
  pollStockpileTiles(civilizationId: string): Promise<StockpileTile[]>;

  /** Persist dirty state accumulated during the tick loop. */
  flush(ctx: SimContext): Promise<void>;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SupabaseStateAdapter implements StateAdapter {
  // Constructor accepts `any` because app/ uses moduleResolution:"bundler" and
  // sim/ uses NodeNext — TypeScript treats the same SupabaseClient type as
  // structurally incompatible across those two resolution modes, even when it
  // resolves to the exact same .d.ts file.  Using `any` here avoids that
  // false-positive type error at the package boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly supabase: any) {}

  async loadState(civilizationId: string, worldId: string): Promise<CachedState> {
    return loadStateFromSupabase(this.supabase, civilizationId, worldId);
  }

  async getWorldSeed(worldId: string): Promise<bigint | null> {
    const { data } = await this.supabase
      .from('worlds')
      .select('seed')
      .eq('id', worldId)
      .single();
    return data?.seed != null ? BigInt(data.seed) : null;
  }

  async pollNewTasks(civilizationId: string, existingTaskIds: Set<string>): Promise<Task[]> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('civilization_id', civilizationId)
      .eq('status', 'pending');
    if (error || !data) return [];
    return (data as Task[]).filter(t => !existingTaskIds.has(t.id));
  }

  async pollStockpileTiles(civilizationId: string): Promise<StockpileTile[]> {
    const { data, error } = await this.supabase
      .from('stockpile_tiles')
      .select('*')
      .eq('civilization_id', civilizationId);
    if (error || !data) return [];
    return data as StockpileTile[];
  }

  async flush(ctx: SimContext): Promise<void> {
    const { flushToSupabase } = await import('./flush-state.js');
    await flushToSupabase(ctx);
  }
}

// ---------------------------------------------------------------------------
// In-memory implementation (for tests and headless scenarios)
// ---------------------------------------------------------------------------

export class InMemoryStateAdapter implements StateAdapter {
  private initialState: CachedState;
  /** Queue of tasks to inject on next pollNewTasks call. */
  private taskQueue: Task[] = [];

  constructor(initialState?: CachedState) {
    this.initialState = initialState ?? createEmptyCachedState();
  }

  async loadState(_civilizationId: string, _worldId: string): Promise<CachedState> {
    return this.initialState;
  }

  async getWorldSeed(_worldId: string): Promise<bigint | null> {
    return null;
  }

  async pollNewTasks(_civilizationId: string, existingTaskIds: Set<string>): Promise<Task[]> {
    const newTasks = this.taskQueue.filter(t => !existingTaskIds.has(t.id));
    this.taskQueue = [];
    return newTasks;
  }

  async pollStockpileTiles(_civilizationId: string): Promise<StockpileTile[]> {
    return [];
  }

  async flush(_ctx: SimContext): Promise<void> {
    // No-op — state lives in-memory
    const { state } = _ctx;
    state.dirtyDwarfIds.clear();
    state.dirtyItemIds.clear();
    state.dirtyStructureIds.clear();
    state.dirtyMonsterIds.clear();
    state.dirtyTaskIds.clear();
    state.dirtyFortressTileKeys.clear();
    state.newTasks = [];
    state.pendingEvents = [];
  }

  /** Inject tasks to be returned on the next pollNewTasks call. */
  queueTasks(tasks: Task[]): void {
    this.taskQueue.push(...tasks);
  }
}
