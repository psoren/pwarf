import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeTask, makeItem, makeMapTile } from "./test-helpers.js";

/**
 * Fuzz testing — run the same scenario across many different seeds.
 * Catches bugs that only surface with specific RNG outcomes (monster
 * spawns, pathfinding tie-breaking, need timing, etc.).
 */

// 10 seeds for CI (fast), run fuzz-runner.ts manually for 50+
const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const TICKS = 200;

function buildScenario(seed: number) {
  const dwarves = [
    makeDwarf({ name: "Urist", position_x: 5, position_y: 5, position_z: 0, need_food: 80, need_drink: 80, need_sleep: 80, need_social: 50 }),
    makeDwarf({ name: "Bomrek", position_x: 6, position_y: 5, position_z: 0, need_food: 80, need_drink: 80, need_sleep: 80, need_social: 50 }),
    makeDwarf({ name: "Litast", position_x: 7, position_y: 5, position_z: 0, need_food: 80, need_drink: 80, need_sleep: 80, need_social: 50 }),
  ];

  const skills = dwarves.flatMap(d => [
    makeSkill(d.id, "mining", 2),
    makeSkill(d.id, "building", 2),
  ]);

  const specialTiles = new Set(["3,5", "3,6", "10,5", "10,6"]);
  const tiles = [
    makeMapTile(3, 5, 0, "tree"),
    makeMapTile(3, 6, 0, "tree"),
    makeMapTile(10, 5, 0, "rock"),
    makeMapTile(10, 6, 0, "rock"),
    ...Array.from({ length: 15 }, (_, x) =>
      Array.from({ length: 15 }, (_, y) => ({ x, y })),
    ).flat()
      .filter(({ x, y }) => !specialTiles.has(`${x},${y}`))
      .map(({ x, y }) => makeMapTile(x, y, 0, "grass")),
  ];

  const tasks = [
    makeTask("mine", { status: "pending", target_x: 3, target_y: 5, target_z: 0, work_required: 100, priority: 10 }),
    makeTask("mine", { status: "pending", target_x: 3, target_y: 6, target_z: 0, work_required: 100, priority: 10 }),
    makeTask("mine", { status: "pending", target_x: 10, target_y: 5, target_z: 0, work_required: 100, priority: 8 }),
    makeTask("mine", { status: "pending", target_x: 10, target_y: 6, target_z: 0, work_required: 100, priority: 8 }),
    makeTask("build_floor", { status: "pending", target_x: 7, target_y: 8, target_z: 0, work_required: 25, priority: 6 }),
    makeTask("build_wall", { status: "pending", target_x: 6, target_y: 8, target_z: 0, work_required: 40, priority: 6 }),
    makeTask("build_door", { status: "pending", target_x: 7, target_y: 9, target_z: 0, work_required: 35, priority: 6 }),
  ];

  const items = [
    ...Array.from({ length: 5 }, () =>
      makeItem({ name: "Plump helmet", category: "food", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    ),
    ...Array.from({ length: 5 }, () =>
      makeItem({ name: "Plump helmet brew", category: "drink", material: "plant", position_x: 5, position_y: 5, position_z: 0, located_in_civ_id: "test-civ" }),
    ),
  ];

  return { dwarves, dwarfSkills: skills, items, tasks, fortressTileOverrides: tiles, ticks: TICKS, seed };
}

describe("multi-seed fuzz (10 seeds × 200 ticks)", () => {
  it.each(SEEDS)("seed %i: no crashes, valid state", async (seed) => {
    const config = buildScenario(seed);
    const result = await runScenario(config);

    // No crashes (if we got here, the sim didn't throw)

    // At least some dwarves should survive (200 ticks isn't long enough to starve)
    const alive = result.dwarves.filter(d => d.status === "alive");
    expect(alive.length).toBeGreaterThan(0);

    // Tasks should not have negative progress
    for (const t of result.tasks) {
      expect(t.work_progress).toBeGreaterThanOrEqual(0);
    }

    // Dwarf needs should be in valid range
    for (const d of result.dwarves) {
      if (d.status !== "alive") continue;
      expect(d.need_food).toBeGreaterThanOrEqual(0);
      expect(d.need_food).toBeLessThanOrEqual(100);
      expect(d.need_drink).toBeGreaterThanOrEqual(0);
      expect(d.need_drink).toBeLessThanOrEqual(100);
      expect(d.need_sleep).toBeGreaterThanOrEqual(0);
      expect(d.need_sleep).toBeLessThanOrEqual(100);
      expect(d.stress_level).toBeGreaterThanOrEqual(0);
      expect(d.health).toBeGreaterThanOrEqual(0);
      expect(d.health).toBeLessThanOrEqual(100);
    }

    // No duplicate task IDs
    const taskIds = result.tasks.map(t => t.id);
    expect(new Set(taskIds).size).toBe(taskIds.length);

    // No duplicate item IDs
    const itemIds = result.items.map(i => i.id);
    expect(new Set(itemIds).size).toBe(itemIds.length);

    // Items should have valid categories
    for (const item of result.items) {
      expect(item.category).toBeTruthy();
      expect(item.name).toBeTruthy();
    }
  });
});
