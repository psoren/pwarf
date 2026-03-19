import type { SupabaseClient } from "@supabase/supabase-js";
import { STEPS_PER_SECOND, STEPS_PER_YEAR } from "@pwarf/shared";
import type { SimContext } from "./sim-context.js";
import { createEmptyCachedState } from "./sim-context.js";
import { loadStateFromSupabase } from "./load-state.js";
import { flushToSupabase } from "./flush-state.js";
import {
  needsDecay,
  taskExecution,
  needSatisfaction,
  stressUpdate,
  tantrumCheck,
  monsterPathfinding,
  combatResolution,
  constructionProgress,
  jobClaiming,
  eventFiring,
  yearlyRollup,
} from "./phases/index.js";

/**
 * Main simulation loop.
 *
 * Runs a fixed-timestep loop at STEPS_PER_SECOND, calling each phase
 * function in deterministic order every tick.
 */
export class SimRunner {
  private supabase: SupabaseClient;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private ctx: SimContext | null = null;

  stepCount = 0;
  currentYear = 1;
  currentDay = 1;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /** Load initial state from Supabase and begin the tick loop. */
  async start(civilizationId: string, worldId?: string): Promise<void> {
    let cached;
    if (worldId) {
      cached = await loadStateFromSupabase(this.supabase, civilizationId, worldId);
    } else {
      cached = createEmptyCachedState();
    }

    this.ctx = {
      supabase: this.supabase,
      civilizationId,
      worldId: worldId ?? '',
      step: this.stepCount,
      year: this.currentYear,
      day: this.currentDay,
      state: cached,
    };

    console.log(
      `[sim] starting simulation for civilization ${civilizationId}`
    );

    const intervalMs = 1000 / STEPS_PER_SECOND;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);

    // Flush dirty state to Supabase every 1 second + poll for new tasks
    this.flushTimer = setInterval(() => {
      if (this.ctx) {
        void flushToSupabase(this.ctx);
        void this.pollNewTasks();
      }
    }, 1000);
  }

  /** Pause the loop and persist state. */
  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush before stopping
    if (this.ctx) {
      await flushToSupabase(this.ctx);
    }

    console.log(`[sim] stopped at step ${this.stepCount}`);
  }

  /** Poll Supabase for new tasks created by the player (designations). */
  private async pollNewTasks(): Promise<void> {
    if (!this.ctx) return;
    const { state, supabase, civilizationId } = this.ctx;

    const existingIds = new Set(state.tasks.map(t => t.id));

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('civilization_id', civilizationId)
      .eq('status', 'pending');

    if (error || !data) return;

    for (const task of data) {
      if (!existingIds.has(task.id)) {
        state.tasks.push(task);
      }
    }
  }

  /** Execute one simulation step — all phases run in order. */
  async tick(): Promise<void> {
    if (!this.ctx) return;

    this.stepCount++;
    this.currentDay++;
    this.ctx.step = this.stepCount;
    this.ctx.day = this.currentDay;
    this.ctx.year = this.currentYear;

    // --- ordered phases ---
    await needsDecay(this.ctx);
    await taskExecution(this.ctx);
    await needSatisfaction(this.ctx);
    await stressUpdate(this.ctx);
    await tantrumCheck(this.ctx);
    await monsterPathfinding(this.ctx);
    await combatResolution(this.ctx);
    await constructionProgress(this.ctx);
    await jobClaiming(this.ctx);
    await eventFiring(this.ctx);

    // Yearly rollup only fires once every STEPS_PER_YEAR steps
    if (this.stepCount % STEPS_PER_YEAR === 0) {
      this.currentYear++;
      this.currentDay = 1;
      this.ctx.year = this.currentYear;
      this.ctx.day = this.currentDay;
      await yearlyRollup(this.ctx);
    }
  }
}
