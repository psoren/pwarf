import { STEPS_PER_SECOND, STEPS_PER_YEAR, STEPS_PER_DAY, SIM_FLUSH_INTERVAL_MS, createFortressDeriver } from "@pwarf/shared";
import type { Dwarf, DwarfSkill, Item, Structure, StockpileTile, Task, WorldEvent, FortressTile, Monster } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { createRng } from "./rng.js";
import type { StateAdapter } from "./state-adapter.js";
import { runTick } from "./tick.js";
import { yearlyRollup } from "./phases/index.js";

/** Snapshot of sim state emitted after every tick for live UI rendering. */
export interface SimSnapshot {
  dwarves: Dwarf[];
  items: Item[];
  tasks: Task[];
  events: WorldEvent[];
  /** All current fortress tile overrides (built/mined tiles). Used so the UI
   * can show tile changes immediately without waiting for the DB flush. */
  fortressTileOverrides: FortressTile[];
  monsters: Monster[];
  year: number;
  civFallen: boolean;
}

/** Full state snapshot for bug reports — includes everything needed to reconstruct a ScenarioConfig. */
export interface BugReportSnapshot {
  dwarves: Dwarf[];
  dwarfSkills: DwarfSkill[];
  items: Item[];
  structures: Structure[];
  tasks: Task[];
  fortressTileOverrides: FortressTile[];
  stockpileTiles: StockpileTile[];
  monsters: Monster[];
  events: WorldEvent[];
  year: number;
  step: number;
}

/**
 * Main simulation loop.
 *
 * Runs a fixed-timestep loop at STEPS_PER_SECOND, calling each phase
 * function in deterministic order every tick.
 */
export class SimRunner {
  private adapter: StateAdapter;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private ctx: SimContext | null = null;

  /** Called after every tick with the current in-memory state. */
  onTick: ((snapshot: SimSnapshot) => void) | null = null;

  stepCount = 0;
  currentYear = 1;
  currentDay = 1;
  isPaused = false;
  speedMultiplier = 1;

  constructor(adapter: StateAdapter) {
    this.adapter = adapter;
  }

  /** Load initial state and begin the tick loop. */
  async start(civilizationId: string, worldId?: string): Promise<void> {
    const cached = worldId
      ? await this.adapter.loadState(civilizationId, worldId)
      : createEmptyCachedState();

    let fortressDeriver = null;
    let civName = '';
    let civTileX = 0;
    let civTileY = 0;
    if (worldId) {
      const [seed, terrain, civInfo] = await Promise.all([
        this.adapter.getWorldSeed(worldId),
        this.adapter.getTerrainForCiv(civilizationId),
        this.adapter.getCivInfo(civilizationId),
      ]);
      if (seed != null) {
        fortressDeriver = createFortressDeriver(seed, civilizationId, terrain ?? 'plains');
      }
      if (civInfo) {
        civName = civInfo.name;
        civTileX = civInfo.tileX;
        civTileY = civInfo.tileY;
      }
    }

    this.ctx = {
      supabase: null as never,
      civilizationId,
      worldId: worldId ?? '',
      civName,
      civTileX,
      civTileY,
      fortressDeriver,
      step: this.stepCount,
      year: this.currentYear,
      day: this.currentDay,
      rng: createRng(Date.now()),
      state: cached,
    };

    console.log(`[sim] starting simulation for civilization ${civilizationId}`);

    const intervalMs = 1000 / (STEPS_PER_SECOND * this.speedMultiplier);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    this.flushTimer = setInterval(() => {
      if (this.ctx) {
        const ctx = this.ctx;
        // Run flush → polls sequentially to avoid auth-lock contention.
        // Polls reuse the cached auth token from the flush request.
        void this.adapter.flush(ctx).then(async () => {
          if (ctx.state.civFallen) {
            console.log(`[sim] civilization ${ctx.civilizationId} has fallen — stopping sim`);
            void this.stop();
            return;
          }
          await this.pollNewTasks();
          await this.pollStockpileTiles();
        });
      }
    }, SIM_FLUSH_INTERVAL_MS);
  }

  /** Freeze the tick loop without flushing or unloading state. */
  pause(): void {
    if (this.isPaused || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.isPaused = true;
  }

  /** Resume a paused tick loop. */
  resume(): void {
    if (!this.isPaused || !this.ctx) return;
    this.isPaused = false;
    const intervalMs = 1000 / (STEPS_PER_SECOND * this.speedMultiplier);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  /** Change tick speed without stopping. 1 = normal, 2 = double, 5 = fast. */
  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
    if (this.isPaused || !this.ctx) return;
    // Restart tick interval at new rate
    if (this.timer) {
      clearInterval(this.timer);
    }
    const intervalMs = 1000 / (STEPS_PER_SECOND * multiplier);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  /** Fully stop the sim, flush state, and unload. */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.ctx) {
      await this.adapter.flush(this.ctx);
    }

    console.log(`[sim] stopped at step ${this.stepCount}`);
  }

  /** Capture full sim state for a bug report. Returns null if the sim isn't running. */
  getBugReportSnapshot(): BugReportSnapshot | null {
    if (!this.ctx) return null;
    const { state } = this.ctx;
    return {
      dwarves: state.dwarves.map(d => ({ ...d })),
      dwarfSkills: state.dwarfSkills.map(s => ({ ...s })),
      items: state.items.map(i => ({ ...i })),
      structures: state.structures.map(s => ({ ...s })),
      tasks: state.tasks.map(t => ({ ...t })),
      fortressTileOverrides: [...state.fortressTileOverrides.values()].map(t => ({ ...t })),
      stockpileTiles: [...state.stockpileTiles.values()].map(t => ({ ...t })),
      monsters: state.monsters.map(m => ({ ...m })),
      events: state.worldEvents.map(e => ({ ...e })),
      year: this.currentYear,
      step: this.stepCount,
    };
  }

  private async pollNewTasks(): Promise<void> {
    if (!this.ctx) return;
    const { state, civilizationId } = this.ctx;
    const existingIds = new Set(state.tasks.map(t => t.id));
    const newTasks = await this.adapter.pollNewTasks(civilizationId, existingIds);
    for (const task of newTasks) {
      state.tasks.push(task);
      state.taskById.set(task.id, task);
    }
  }

  private async pollStockpileTiles(): Promise<void> {
    if (!this.ctx) return;
    const { state, civilizationId } = this.ctx;
    const tiles = await this.adapter.pollStockpileTiles(civilizationId);
    state.stockpileTiles.clear();
    for (const tile of tiles) {
      state.stockpileTiles.set(`${tile.x},${tile.y},${tile.z}`, tile);
    }
  }

  /** Execute one simulation step — all phases run in order. */
  async tick(): Promise<void> {
    if (!this.ctx) return;

    this.stepCount++;
    this.currentDay = Math.floor((this.stepCount % STEPS_PER_YEAR) / STEPS_PER_DAY) + 1;
    this.ctx.step = this.stepCount;
    this.ctx.day = this.currentDay;
    this.ctx.year = this.currentYear;

    await runTick(this.ctx);

    if (this.stepCount % STEPS_PER_YEAR === 0) {
      this.currentYear++;
      this.currentDay = 1;
      this.ctx.year = this.currentYear;
      this.ctx.day = this.currentDay;
      await yearlyRollup(this.ctx);
    }

    if (this.onTick) {
      this.onTick({
        dwarves: this.ctx.state.dwarves,
        items: this.ctx.state.items,
        tasks: [...this.ctx.state.tasks],
        events: this.ctx.state.worldEvents,
        fortressTileOverrides: [...this.ctx.state.fortressTileOverrides.values()],
        monsters: this.ctx.state.monsters,
        year: this.currentYear,
        civFallen: this.ctx.state.civFallen,
      });
    }
  }
}
