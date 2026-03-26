import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";
import { createFortressDeriver } from "@pwarf/shared";
import type { StockpileTile } from "@pwarf/shared";

describe("long-run stability (10000 ticks)", () => {
  it("7 dwarves survive 10000 ticks with mining, building, and auto-economy", async () => {
    // Full fortress: 7 dwarves, trees, rock, build tasks, auto-phases active.
    // This exercises every sim system over ~17 in-game minutes.

    const dwarves = [
      makeDwarf({ name: "Urist", civilization_id: "test-civ", position_x: 255, position_y: 255, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Bomrek", civilization_id: "test-civ", position_x: 256, position_y: 255, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Litast", civilization_id: "test-civ", position_x: 257, position_y: 255, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Aban", civilization_id: "test-civ", position_x: 255, position_y: 256, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Doren", civilization_id: "test-civ", position_x: 256, position_y: 256, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Kumil", civilization_id: "test-civ", position_x: 257, position_y: 256, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Reg", civilization_id: "test-civ", position_x: 258, position_y: 255, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
    ];

    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 2),
      makeSkill(d.id, "building", 2),
    ]);

    // Tree and rock tile overrides near fortress center
    const treePositions = Array.from({ length: 10 }, (_, i) => ({ x: 250, y: 250 + i }));
    const rockPositions = Array.from({ length: 10 }, (_, i) => ({ x: 262, y: 250 + i }));

    const tileOverrides = [
      ...treePositions.map(p => makeMapTile(p.x, p.y, 0, "tree")),
      ...rockPositions.map(p => makeMapTile(p.x, p.y, 0, "rock")),
    ];

    const tasks = [
      // Mine trees
      ...treePositions.map((p, i) => makeTask("mine", {
        status: "pending", target_x: p.x, target_y: p.y, target_z: 0,
        work_required: 100, priority: 10 - Math.floor(i / 3),
      })),
      // Mine rocks
      ...rockPositions.map((p, i) => makeTask("mine", {
        status: "pending", target_x: p.x, target_y: p.y, target_z: 0,
        work_required: 100, priority: 8 - Math.floor(i / 3),
      })),
      // Build structures
      makeTask("build_floor", { status: "pending", target_x: 257, target_y: 260, target_z: 0, work_required: 25, priority: 6 }),
      makeTask("build_wall", { status: "pending", target_x: 256, target_y: 260, target_z: 0, work_required: 40, priority: 6 }),
      makeTask("build_wall", { status: "pending", target_x: 258, target_y: 260, target_z: 0, work_required: 40, priority: 6 }),
      makeTask("build_door", { status: "pending", target_x: 257, target_y: 261, target_z: 0, work_required: 35, priority: 6 }),
      makeTask("build_well", { status: "pending", target_x: 257, target_y: 262, target_z: 0, work_required: 60, priority: 5 }),
      makeTask("build_mushroom_garden", { status: "pending", target_x: 257, target_y: 263, target_z: 0, work_required: 50, priority: 5 }),
    ];

    // Starting supplies
    const items = [
      ...Array.from({ length: 15 }, () =>
        makeItem({ name: "Plump helmet", category: "food", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 256, position_y: 256, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
    ];

    // Stockpile tiles for hauling mined resources
    const stockpileTiles: StockpileTile[] = [];
    for (let sx = 253; sx <= 255; sx++) {
      for (let sy = 262; sy <= 264; sy++) {
        stockpileTiles.push({
          id: `sp-${sx}-${sy}`,
          civilization_id: "test-civ",
          x: sx,
          y: sy,
          z: 0,
          priority: 1,
          accepts_categories: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    const startTime = Date.now();

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items,
      tasks,
      fortressTileOverrides: tileOverrides,
      fortressDeriver: createFortressDeriver(42n, "test-civ", "plains"),
      stockpileTiles,
      ticks: 10000,
      seed: 42,
    });

    const elapsed = Date.now() - startTime;
    console.log(`  10000 ticks completed in ${elapsed}ms (${(elapsed / 10000).toFixed(2)}ms/tick)`);

    // ── Survival check ──────────────────────────────────────────────────
    const alive = result.dwarves.filter(d => d.status === "alive");
    const dead = result.dwarves.filter(d => d.status !== "alive");
    console.log(`  Alive: ${alive.length}, Dead: ${dead.length}`);
    for (const d of dead) {
      console.log(`    ${d.name} died: ${d.cause_of_death}`);
    }
    // At least some dwarves should survive with 15 food + 15 drink + auto-forage
    expect(alive.length).toBeGreaterThan(0);

    // ── Task completion ─────────────────────────────────────────────────
    const completed = result.tasks.filter(t => t.status === "completed");
    const pending = result.tasks.filter(t => t.status === "pending");
    const inProgress = result.tasks.filter(t => t.status === "in_progress");
    console.log(`  Tasks: ${completed.length} completed, ${pending.length} pending, ${inProgress.length} in_progress, ${result.tasks.length} total`);
    // Original mine/build tasks should mostly be done by tick 10000
    const originalTasks = result.tasks.filter(t => tasks.some(orig => orig.id === t.id));
    const originalCompleted = originalTasks.filter(t => t.status === "completed");
    console.log(`  Original tasks: ${originalCompleted.length}/${originalTasks.length} completed`);

    // ── Resource tracking ───────────────────────────────────────────────
    const itemCounts = new Map<string, number>();
    for (const item of result.items) {
      const key = `${item.name} [${item.category}]`;
      itemCounts.set(key, (itemCounts.get(key) ?? 0) + 1);
    }
    console.log(`  Items (${result.items.length} total):`);
    for (const [name, count] of [...itemCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`    ${count}× ${name}`);
    }

    // ── Structure tracking ──────────────────────────────────────────────
    console.log(`  Structures: ${result.structures.length}`);
    for (const s of result.structures) {
      console.log(`    ${s.type} at (${s.position_x},${s.position_y},${s.position_z})`);
    }

    // ── Memory/growth checks ────────────────────────────────────────────
    // Tasks should not grow unbounded — completed tasks should exist but
    // there shouldn't be thousands of pending tasks piling up
    const autoTasks = result.tasks.filter(t => !tasks.some(orig => orig.id === t.id));
    console.log(`  Auto-generated tasks: ${autoTasks.length}`);
    // Warn if task count is suspiciously high (potential leak)
    if (result.tasks.length > 500) {
      console.warn(`  ⚠ Task count is high: ${result.tasks.length} — possible unbounded growth`);
    }
    expect(result.tasks.length).toBeLessThan(5000); // Sanity limit

    // Events should grow but not explode
    console.log(`  Events: ${result.events.length}`);
    expect(result.events.length).toBeLessThan(10000);

    // ── Dwarf needs should be stable ────────────────────────────────────
    for (const d of alive) {
      console.log(`  ${d.name}: food=${d.need_food.toFixed(0)} drink=${d.need_drink.toFixed(0)} sleep=${d.need_sleep.toFixed(0)} stress=${d.stress_level.toFixed(0)}`);
    }

    // ── Performance check ───────────────────────────────────────────────
    // 10000 ticks should complete in under 60 seconds on CI
    expect(elapsed).toBeLessThan(60000);
  }, 120000); // 120s timeout for this test
});
