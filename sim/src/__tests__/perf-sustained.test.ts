import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";
import { createRng } from "../rng.js";
import { createFortressDeriver, SKILL_NAMES } from "@pwarf/shared";
import { runTick, advanceTime } from "../tick.js";
import { makeDwarf, makeSkill, makeItem, makeStructure } from "./test-helpers.js";

describe("sustained activity performance", () => {
  it("stays under 5ms/tick with 7 dwarves, mining, hauling, and stockpiles", async () => {
    const state = createEmptyCachedState();
    const rng = createRng(42);

    const dwarves = Array.from({ length: 7 }, (_, i) =>
      makeDwarf({
        name: `Dwarf${i}`,
        position_x: 256 + (i % 3),
        position_y: 256 + Math.floor(i / 3),
        position_z: 0,
        need_food: 100,
        need_drink: 100,
        need_sleep: 100,
        need_social: 80,
      })
    );
    state.dwarves = dwarves;

    for (const d of dwarves) {
      for (const skill of SKILL_NAMES) {
        state.dwarfSkills.push(makeSkill(d.id, skill, 2));
      }
    }

    // Abundant food and drink
    for (let i = 0; i < 50; i++) {
      state.items.push(makeItem({
        category: "food",
        position_x: 258, position_y: 258, position_z: 0,
        located_in_civ_id: "test-civ",
      }));
      state.items.push(makeItem({
        category: "drink",
        name: "Dwarven ale",
        position_x: 259, position_y: 258, position_z: 0,
        located_in_civ_id: "test-civ",
      }));
    }

    state.structures.push(makeStructure({
      type: "well",
      position_x: 260, position_y: 258, position_z: 0,
      completion_pct: 100,
    }));

    for (let i = 0; i < 7; i++) {
      state.structures.push(makeStructure({
        type: "bed",
        position_x: 254 + i, position_y: 260, position_z: 0,
        completion_pct: 100,
      }));
    }

    // Stockpile tiles
    for (let x = 250; x < 260; x++) {
      for (let y = 262; y < 265; y++) {
        state.stockpileTiles.set(`${x},${y},0`, {
          x, y, z: 0, priority: 1, accepts_categories: null,
        });
      }
    }

    // Mine tasks
    for (let i = 0; i < 50; i++) {
      state.tasks.push({
        id: rng.uuid(),
        civilization_id: "test-civ",
        task_type: "mine",
        status: "pending",
        priority: 5,
        assigned_dwarf_id: null,
        target_x: 250 + (i % 10),
        target_y: 250 + Math.floor(i / 10),
        target_z: 0,
        target_item_id: null,
        work_progress: 0,
        work_required: 50,
        created_at: new Date().toISOString(),
        completed_at: null,
      });
    }
    // Rebuild task index
    for (const t of state.tasks) state.taskById.set(t.id, t);

    // Walkable area with rock targets
    for (let x = 245; x < 270; x++) {
      for (let y = 245; y < 270; y++) {
        state.fortressTileOverrides.set(`${x},${y},0`, {
          id: `tile-${x}-${y}`,
          civilization_id: "test-civ",
          x, y, z: 0,
          tile_type: (x >= 250 && x < 260 && y >= 250 && y < 255) ? "rock" : "open_air",
          material: null,
          is_revealed: true,
          is_mined: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    const deriver = createFortressDeriver(42n, "test-civ", "plains");

    const ctx: SimContext = {
      supabase: null as unknown as SupabaseClient,
      civilizationId: "test-civ",
      worldId: "test-world",
      civName: "Perf Test",
      civTileX: 0,
      civTileY: 0,
      fortressDeriver: deriver,
      step: 0,
      year: 1,
      day: 1,
      rng: createRng(42),
      state,
    };

    const TICKS = 3000;
    const BUCKET = 500;
    const bucketTimes: number[] = [];
    let stepCount = 0;

    for (let bucket = 0; bucket < TICKS / BUCKET; bucket++) {
      const start = performance.now();
      for (let i = 0; i < BUCKET; i++) {
        stepCount++;
        advanceTime(ctx, stepCount, 1);
        await runTick(ctx);
        if (state.pendingEvents.length > 0) {
          state.worldEvents.push(...state.pendingEvents);
          state.pendingEvents = [];
        }
      }
      bucketTimes.push(performance.now() - start);
    }

    // Log results
    console.log(`\n=== Sustained Perf: ${TICKS} ticks, 7 dwarves ===`);
    for (let i = 0; i < bucketTimes.length; i++) {
      const range = `${i * BUCKET + 1}-${(i + 1) * BUCKET}`;
      console.log(`  Ticks ${range.padEnd(12)} ${(bucketTimes[i] / BUCKET).toFixed(3)}ms/tick`);
    }
    console.log(`  Tasks: ${state.tasks.length} (completed: ${state.tasks.filter(t => t.status === "completed").length})`);
    console.log(`  Items: ${state.items.length}`);
    console.log(`  Dwarves alive: ${state.dwarves.filter(d => d.status === "alive").length}`);

    // Assert steady-state performance: last bucket should be under 5ms/tick
    const lastBucketMsPerTick = bucketTimes[bucketTimes.length - 1] / BUCKET;
    expect(lastBucketMsPerTick).toBeLessThan(5);

    // Assert no severe degradation (last bucket should be < 3x first)
    const firstBucketMsPerTick = bucketTimes[0] / BUCKET;
    if (firstBucketMsPerTick > 0.1) {
      expect(lastBucketMsPerTick / firstBucketMsPerTick).toBeLessThan(3);
    }
  }, 120_000);
});
