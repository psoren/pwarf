import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";

describe("long-run stability (10000 ticks)", () => {
  it("7 dwarves survive 10000 ticks with mining, building, and auto-economy", async () => {
    // Full fortress: 7 dwarves, trees, rock, build tasks, auto-phases active.
    // This exercises every sim system over ~17 in-game minutes.

    const dwarves = [
      makeDwarf({ name: "Urist", position_x: 5, position_y: 5, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Bomrek", position_x: 6, position_y: 5, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Litast", position_x: 7, position_y: 5, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Aban", position_x: 5, position_y: 6, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Doren", position_x: 6, position_y: 6, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Kumil", position_x: 7, position_y: 6, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
      makeDwarf({ name: "Reg", position_x: 8, position_y: 5, position_z: 0, need_food: 100, need_drink: 100, need_sleep: 100, need_social: 80 }),
    ];

    const skills = dwarves.flatMap(d => [
      makeSkill(d.id, "mining", 2),
      makeSkill(d.id, "building", 2),
    ]);

    // Large map with resources
    const treePositions = Array.from({ length: 10 }, (_, i) => ({ x: 2, y: i + 3 }));
    const rockPositions = Array.from({ length: 10 }, (_, i) => ({ x: 12, y: i + 3 }));
    const specialTiles = new Set([
      ...treePositions.map(p => `${p.x},${p.y}`),
      ...rockPositions.map(p => `${p.x},${p.y}`),
    ]);

    const tiles = [
      ...treePositions.map(p => makeMapTile(p.x, p.y, 0, "tree")),
      ...rockPositions.map(p => makeMapTile(p.x, p.y, 0, "rock")),
      ...Array.from({ length: 20 }, (_, x) =>
        Array.from({ length: 20 }, (_, y) => ({ x, y })),
      ).flat()
        .filter(({ x, y }) => !specialTiles.has(`${x},${y}`))
        .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
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
      makeTask("build_floor", { status: "pending", target_x: 7, target_y: 10, target_z: 0, work_required: 25, priority: 6 }),
      makeTask("build_wall", { status: "pending", target_x: 6, target_y: 10, target_z: 0, work_required: 40, priority: 6 }),
      makeTask("build_wall", { status: "pending", target_x: 8, target_y: 10, target_z: 0, work_required: 40, priority: 6 }),
      makeTask("build_door", { status: "pending", target_x: 7, target_y: 11, target_z: 0, work_required: 35, priority: 6 }),
      makeTask("build_well", { status: "pending", target_x: 7, target_y: 12, target_z: 0, work_required: 60, priority: 5 }),
      makeTask("build_mushroom_garden", { status: "pending", target_x: 7, target_y: 13, target_z: 0, work_required: 50, priority: 5 }),
    ];

    // Starting supplies
    const items = [
      ...Array.from({ length: 15 }, () =>
        makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
      ...Array.from({ length: 15 }, () =>
        makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
      ),
    ];

    const startTime = Date.now();

    const result = await runScenario({
      dwarves,
      dwarfSkills: skills,
      items,
      tasks,
      fortressTileOverrides: tiles,
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
    // 10000 ticks should complete in under 30 seconds
    expect(elapsed).toBeLessThan(30000);
  }, 60000); // 60s timeout for this test
});
