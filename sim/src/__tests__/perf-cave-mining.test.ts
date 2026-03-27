import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimContext } from "../sim-context.js";
import { createEmptyCachedState } from "../sim-context.js";
import { createRng } from "../rng.js";
import {
  createFortressDeriver,
  SKILL_NAMES,
  CAVE_OFFSET,
  CAVE_SIZE,
  WORK_SCOUT_CAVE,
} from "@pwarf/shared";
import { runTick, advanceTime } from "../tick.js";
import { makeDwarf, makeSkill, makeItem, makeStructure } from "./test-helpers.js";

/**
 * Performance test for cave mining — reproduces the reported slowdown
 * that occurs after scouting a cave and designating underground mine tasks.
 *
 * The test measures ms/tick in buckets and asserts no severe degradation
 * over time. The key scenarios:
 * 1. Scout cave completes → first pathfinding underground triggers expensive
 *    buildCaveForEntrance() synchronously inside the pathfinding loop
 * 2. Multiple dwarves pathfinding underground simultaneously
 */

const CIV_ID = "perf-cave-civ";

describe("cave mining performance", () => {
  it("ms/tick does not degrade severely during underground mining", async () => {
    const state = createEmptyCachedState();
    const rng = createRng(42);
    const deriver = createFortressDeriver(42n, CIV_ID, "plains");
    const entrance = deriver.entrances[0]!;
    const caveZ = deriver.getZForEntrance(entrance.x, entrance.y)!;

    // Set up 5 dwarves near the cave entrance
    const dwarves = Array.from({ length: 5 }, (_, i) =>
      makeDwarf({
        civilization_id: CIV_ID,
        name: `Miner${i}`,
        position_x: entrance.x + (i % 3),
        position_y: entrance.y + Math.floor(i / 3),
        position_z: 0,
        need_food: 100,
        need_drink: 100,
        need_sleep: 100,
        need_social: 80,
      }),
    );
    state.dwarves = dwarves;

    for (const d of dwarves) {
      for (const skill of SKILL_NAMES) {
        state.dwarfSkills.push(makeSkill(d.id, skill, 3));
      }
    }

    // Abundant food/drink near the entrance
    for (let i = 0; i < 30; i++) {
      state.items.push(makeItem({
        category: "food",
        position_x: entrance.x, position_y: entrance.y + 2, position_z: 0,
        located_in_civ_id: CIV_ID,
      }));
      state.items.push(makeItem({
        category: "drink",
        name: "Dwarven ale",
        position_x: entrance.x + 1, position_y: entrance.y + 2, position_z: 0,
        located_in_civ_id: CIV_ID,
      }));
    }

    // Bed and well near entrance
    state.structures.push(makeStructure({
      civilization_id: CIV_ID,
      type: "well", completion_pct: 100,
      position_x: entrance.x + 2, position_y: entrance.y + 2, position_z: 0,
    }));
    for (let i = 0; i < 5; i++) {
      state.structures.push(makeStructure({
        civilization_id: CIV_ID,
        type: "bed", completion_pct: 100,
        position_x: entrance.x + i, position_y: entrance.y + 3, position_z: 0,
      }));
    }

    // Stockpile near entrance
    for (let x = entrance.x - 2; x <= entrance.x + 4; x++) {
      for (let y = entrance.y + 4; y <= entrance.y + 6; y++) {
        state.stockpileTiles.set(`${x},${y},0`, {
          id: `sp-${x}-${y}`,
          civilization_id: CIV_ID,
          x, y, z: 0, priority: 1, accepts_categories: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Walkable surface area around the entrance
    for (let x = entrance.x - 5; x <= entrance.x + 10; x++) {
      for (let y = entrance.y - 5; y <= entrance.y + 10; y++) {
        state.fortressTileOverrides.set(`${x},${y},0`, {
          id: rng.uuid(),
          civilization_id: CIV_ID,
          x, y, z: 0,
          tile_type: "open_air",
          material: null,
          is_revealed: true,
          is_mined: false,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Mark the entrance tile so pathfinding can transition z-levels
    state.fortressTileOverrides.set(`${entrance.x},${entrance.y},0`, {
      id: rng.uuid(),
      civilization_id: CIV_ID,
      x: entrance.x, y: entrance.y, z: 0,
      tile_type: "cave_entrance",
      material: null,
      is_revealed: true,
      is_mined: false,
      created_at: new Date().toISOString(),
    });

    // Place a cavern_floor marker at the entrance on the cave level
    // (simulates what completeScoutCave does)
    state.fortressTileOverrides.set(`${entrance.x},${entrance.y},${caveZ}`, {
      id: rng.uuid(),
      civilization_id: CIV_ID,
      x: entrance.x, y: entrance.y, z: caveZ,
      tile_type: "cavern_floor",
      material: null,
      is_revealed: true,
      is_mined: false,
      created_at: new Date().toISOString(),
    });

    // Find cavern_wall tiles adjacent to cavern_floor at cave z-level.
    // These are actually mineable — the dwarf can stand on the floor and mine the wall.
    const mineTargets: Array<{ x: number; y: number }> = [];
    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let dx = -20; dx <= 20 && mineTargets.length < 15; dx++) {
      for (let dy = -20; dy <= 20 && mineTargets.length < 15; dy++) {
        const tx = entrance.x + dx;
        const ty = entrance.y + dy;
        if (tx === entrance.x && ty === entrance.y) continue;
        const tile = deriver.deriveTile(tx, ty, caveZ);
        if (tile.tileType !== "cavern_wall") continue;
        // Check if any neighbor is walkable floor
        const hasFloorNeighbor = deltas.some(([ddx, ddy]) => {
          const n = deriver.deriveTile(tx + ddx!, ty + ddy!, caveZ);
          return n.tileType === "cavern_floor" || n.tileType === "cave_mushroom";
        });
        if (hasFloorNeighbor) {
          mineTargets.push({ x: tx, y: ty });
        }
      }
    }

    // Create mine tasks for underground cavern_wall tiles
    for (const target of mineTargets) {
      const task = {
        id: rng.uuid(),
        civilization_id: CIV_ID,
        task_type: "mine" as const,
        status: "pending" as const,
        priority: 5,
        assigned_dwarf_id: null,
        target_x: target.x,
        target_y: target.y,
        target_z: caveZ,
        target_item_id: null,
        work_progress: 0,
        work_required: 50,
        created_at: new Date().toISOString(),
        completed_at: null,
      };
      state.tasks.push(task);
      state.taskById.set(task.id, task);
    }

    const ctx: SimContext = {
      supabase: null as unknown as SupabaseClient,
      civilizationId: CIV_ID,
      worldId: "test-world",
      civName: "Cave Perf Test",
      civTileX: 0,
      civTileY: 0,
      fortressDeriver: deriver,
      step: 0,
      year: 1,
      day: 1,
      rng: createRng(99),
      state,
    };

    const TICKS = 1000;
    const BUCKET = 200;
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
    console.log(`\n=== Cave Mining Perf: ${TICKS} ticks, 5 dwarves, ${mineTargets.length} mine tasks ===`);
    for (let i = 0; i < bucketTimes.length; i++) {
      const range = `${i * BUCKET + 1}-${(i + 1) * BUCKET}`;
      console.log(`  Ticks ${range.padEnd(12)} ${(bucketTimes[i] / BUCKET).toFixed(3)}ms/tick`);
    }
    console.log(`  Tasks: ${state.tasks.length} (completed: ${state.tasks.filter(t => t.status === "completed").length})`);
    console.log(`  Dwarves alive: ${state.dwarves.filter(d => d.status === "alive").length}`);
    console.log(`  Tile overrides: ${state.fortressTileOverrides.size}`);

    // Warm buckets (after first) should be comparable to surface mining perf.
    // Surface mining runs at ~1-5ms/tick. Cave mining should not be 10x+ worse.
    const warmBucketMs = bucketTimes.slice(1).map(t => t / BUCKET);
    const avgWarmMs = warmBucketMs.reduce((a, b) => a + b, 0) / warmBucketMs.length;
    console.log(`  Avg warm ms/tick: ${avgWarmMs.toFixed(3)}`);

    // Skip absolute ms/tick threshold — CI runners are much slower than local.
    // The degradation ratio below catches regressions environment-independently.

    // No degradation over time
    const secondBucketMs = bucketTimes[1] / BUCKET;
    const lastBucketMs = bucketTimes[bucketTimes.length - 1] / BUCKET;
    if (secondBucketMs > 0.01) {
      expect(lastBucketMs / secondBucketMs).toBeLessThan(3);
    }
  }, 120_000);
});
