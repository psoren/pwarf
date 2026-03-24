import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import type { StockpileTile } from "@pwarf/shared";
import {
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  WORK_BUILD_MUSHROOM_GARDEN,
} from "@pwarf/shared";
import { makeDwarf, makeItem, makeSkill, makeTask, makeMapTile } from "./test-helpers.js";

function makeStockpileTile(x: number, y: number, z: number): StockpileTile {
  return {
    id: crypto.randomUUID(),
    civilization_id: "test-civ",
    x, y, z,
    accepts_categories: null,
    priority: 0,
    created_at: new Date().toISOString(),
  };
}

describe("building scenario", () => {
  const buildTypes = [
    { taskType: "build_wall", work: WORK_BUILD_WALL, material: "stone", count: 1, resultTile: "constructed_wall" },
    { taskType: "build_floor", work: WORK_BUILD_FLOOR, material: "stone", count: 1, resultTile: "constructed_floor" },
    { taskType: "build_bed", work: WORK_BUILD_BED, material: "wood", count: 1, resultTile: "bed" },
    { taskType: "build_well", work: WORK_BUILD_WELL, material: "stone", count: 2, resultTile: "well" },
    { taskType: "build_mushroom_garden", work: WORK_BUILD_MUSHROOM_GARDEN, material: "wood", count: 1, resultTile: "mushroom_garden" },
  ] as const;

  for (const { taskType, work, material, count, resultTile } of buildTypes) {
    it(`completes ${taskType} in a headless scenario`, async () => {
      const dwarf = makeDwarf({ position_x: 10, position_y: 9, position_z: 0 });
      const resources = Array.from({ length: count }, (_, i) =>
        makeItem({
          name: `${material} block`,
          category: "raw_material",
          material,
          located_in_civ_id: "test-civ",
          held_by_dwarf_id: null,
          position_x: 5 + i,
          position_y: 5,
          position_z: 0,
        }),
      );

      // Place walkable tiles so pathfinding works
      const tiles = [
        makeMapTile(10, 9, 0, "grass"),
        makeMapTile(10, 10, 0, "grass"),
      ];

      const task = makeTask(taskType, {
        civilization_id: "test-civ",
        status: "pending",
        target_x: 10,
        target_y: 10,
        target_z: 0,
        work_required: work,
      });

      const result = await runScenario({
        dwarves: [dwarf],
        dwarfSkills: [makeSkill(dwarf.id, "building", 1)],
        items: resources,
        tasks: [task],
        fortressTileOverrides: tiles,
        ticks: 200,
      });

      const completed = result.tasks.filter(t => t.task_type === taskType && t.status === "completed");
      expect(completed).toHaveLength(1);

      const builtTile = result.fortressTileOverrides.find(
        t => t.x === 10 && t.y === 10 && t.z === 0,
      );
      expect(builtTile).toBeDefined();
      expect(builtTile!.tile_type).toBe(resultTile);
    });
  }
});

describe("stockpile hauling scenario", () => {
  it("idle dwarf picks up ground item and hauls to stockpile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      located_in_civ_id: "test-civ",
      held_by_dwarf_id: null,
      position_x: 7,
      position_y: 5,
      position_z: 0,
    });

    // Place walkable tiles for pathfinding
    const tiles = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(makeMapTile(x, 5, 0, "grass"));
    }

    const stockpile = makeStockpileTile(12, 5, 0);

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "building", 0)],
      items: [groundItem],
      fortressTileOverrides: tiles,
      stockpileTiles: [stockpile],
      ticks: 500,
    });

    // A haul task should have been created
    const haulTasks = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === groundItem.id,
    );
    expect(haulTasks.length).toBeGreaterThanOrEqual(1);

    // At least one haul should have completed
    const completedHauls = haulTasks.filter(t => t.status === "completed");
    expect(completedHauls.length).toBeGreaterThanOrEqual(1);

    // The completed haul should target the stockpile position
    expect(completedHauls[0].target_x).toBe(12);
    expect(completedHauls[0].target_y).toBe(5);
  });

  it("does not create duplicate haul tasks for the same item", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      located_in_civ_id: "test-civ",
      held_by_dwarf_id: null,
      position_x: 7,
      position_y: 5,
      position_z: 0,
    });

    const tiles = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(makeMapTile(x, 5, 0, "grass"));
    }

    const stockpile = makeStockpileTile(12, 5, 0);

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [],
      items: [groundItem],
      fortressTileOverrides: tiles,
      stockpileTiles: [stockpile],
      ticks: 50,
    });

    // Should not create multiple haul tasks for the same item
    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    // At most 1 active + potentially 1 completed (if first failed and retried)
    const activeHauls = haulTasks.filter(t => t.status !== "completed" && t.status !== "failed" && t.status !== "cancelled");
    expect(activeHauls.length).toBeLessThanOrEqual(1);
  });

  it("skips items already on a stockpile tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    // Item is already on the stockpile
    const itemOnStockpile = makeItem({
      name: "Stone block",
      category: "raw_material",
      material: "stone",
      located_in_civ_id: "test-civ",
      held_by_dwarf_id: null,
      position_x: 12,
      position_y: 5,
      position_z: 0,
    });

    const tiles = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(makeMapTile(x, 5, 0, "grass"));
    }

    const stockpile = makeStockpileTile(12, 5, 0);

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [],
      items: [itemOnStockpile],
      fortressTileOverrides: tiles,
      stockpileTiles: [stockpile],
      ticks: 20,
    });

    // No haul task for THIS item — it's already on the stockpile
    const haulTasksForItem = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === itemOnStockpile.id,
    );
    expect(haulTasksForItem).toHaveLength(0);
  });
});
