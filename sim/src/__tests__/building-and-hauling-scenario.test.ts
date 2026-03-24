import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem } from "./test-helpers.js";
import {
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  WORK_BUILD_MUSHROOM_GARDEN,
} from "@pwarf/shared";
import type { FortressTile, StockpileTile } from "@pwarf/shared";

function stoneBlock() {
  return makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
function woodLog() {
  return makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}

function grassTile(x: number, y: number, z: number): FortressTile {
  return {
    id: `grass-${x}-${y}-${z}`,
    civilization_id: "civ-1",
    x, y, z,
    tile_type: "grass",
    material: null,
    is_revealed: true,
    is_mined: false,
    created_at: new Date().toISOString(),
  };
}

function makeStockpileTile(x: number, y: number, z: number): StockpileTile {
  return {
    id: `stockpile-${x}-${y}-${z}`,
    civilization_id: "test-civ",
    x, y, z,
    accepts_categories: null,
    priority: 0,
    created_at: new Date().toISOString(),
  };
}

describe("building scenarios", () => {
  it("dwarf completes build_wall task", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const task = makeTask("build_wall", {
      status: "pending",
      target_x: 10, target_y: 10, target_z: 0,
      work_required: WORK_BUILD_WALL,
    });

    const tiles = [grassTile(9, 10, 0), grassTile(10, 10, 0)];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [task],
      items: [stoneBlock()],
      fortressTileOverrides: tiles,
      ticks: 200,
    });

    expect(result.tasks.find(t => t.id === task.id)?.status).toBe("completed");
    const wallTile = result.fortressTileOverrides.find(t => t.x === 10 && t.y === 10 && t.z === 0);
    expect(wallTile?.tile_type).toBe("constructed_wall");
  });

  it("dwarf completes build_floor task", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const task = makeTask("build_floor", {
      status: "pending",
      target_x: 10, target_y: 10, target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });

    const tiles = [grassTile(9, 10, 0), grassTile(10, 10, 0)];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [task],
      items: [stoneBlock()],
      fortressTileOverrides: tiles,
      ticks: 200,
    });

    expect(result.tasks.find(t => t.id === task.id)?.status).toBe("completed");
    const floorTile = result.fortressTileOverrides.find(t => t.x === 10 && t.y === 10 && t.z === 0);
    expect(floorTile?.tile_type).toBe("constructed_floor");
  });

  it("dwarf completes build_bed task", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const task = makeTask("build_bed", {
      status: "pending",
      target_x: 10, target_y: 10, target_z: 0,
      work_required: WORK_BUILD_BED,
    });

    const tiles = [grassTile(9, 10, 0), grassTile(10, 10, 0)];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [task],
      items: [woodLog()],
      fortressTileOverrides: tiles,
      ticks: 200,
    });

    expect(result.tasks.find(t => t.id === task.id)?.status).toBe("completed");
    const bed = result.structures.find(s => s.type === "bed");
    expect(bed).toBeDefined();
    expect(bed?.completion_pct).toBe(100);
  });

  it("dwarf completes build_well task", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const task = makeTask("build_well", {
      status: "pending",
      target_x: 10, target_y: 10, target_z: 0,
      work_required: WORK_BUILD_WELL,
    });

    const tiles = [grassTile(9, 10, 0), grassTile(10, 10, 0)];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [task],
      items: [stoneBlock(), stoneBlock()],
      fortressTileOverrides: tiles,
      ticks: 200,
    });

    expect(result.tasks.find(t => t.id === task.id)?.status).toBe("completed");
    const well = result.structures.find(s => s.type === "well");
    expect(well).toBeDefined();
    expect(well?.completion_pct).toBe(100);
  });

  it("dwarf completes build_mushroom_garden task", async () => {
    const dwarf = makeDwarf({ position_x: 9, position_y: 10, position_z: 0 });
    const buildSkill = makeSkill(dwarf.id, "building", 1);
    const task = makeTask("build_mushroom_garden", {
      status: "pending",
      target_x: 10, target_y: 10, target_z: 0,
      work_required: WORK_BUILD_MUSHROOM_GARDEN,
    });

    const tiles = [grassTile(9, 10, 0), grassTile(10, 10, 0)];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [task],
      items: [woodLog()],
      fortressTileOverrides: tiles,
      ticks: 200,
    });

    expect(result.tasks.find(t => t.id === task.id)?.status).toBe("completed");
    const garden = result.structures.find(s => s.type === "mushroom_garden");
    expect(garden).toBeDefined();
    expect(garden?.completion_pct).toBe(100);
  });
});

describe("stockpile hauling scenarios", () => {
  it("idle dwarf picks up ground item and hauls to stockpile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      position_x: 7, position_y: 5, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "test-civ",
    });

    // Grass tiles from x=3..15 for pathfinding
    const tiles: FortressTile[] = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(grassTile(x, 5, 0));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem],
      fortressTileOverrides: tiles,
      stockpileTiles: [makeStockpileTile(12, 5, 0)],
      ticks: 500,
    });

    const haulTasks = result.tasks.filter(t => t.task_type === "haul" && t.target_item_id === groundItem.id);
    expect(haulTasks.length).toBeGreaterThanOrEqual(1);
    const completed = haulTasks.find(t => t.status === "completed");
    expect(completed).toBeDefined();
    expect(completed?.target_x).toBe(12);
    expect(completed?.target_y).toBe(5);
  });

  it("does not create duplicate haul tasks", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const groundItem = makeItem({
      position_x: 7, position_y: 5, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "test-civ",
    });

    const tiles: FortressTile[] = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(grassTile(x, 5, 0));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      items: [groundItem],
      fortressTileOverrides: tiles,
      stockpileTiles: [makeStockpileTile(12, 5, 0)],
      ticks: 50,
    });

    const activeHaulTasks = result.tasks.filter(
      t => t.task_type === "haul"
        && t.target_item_id === groundItem.id
        && t.status !== "completed" && t.status !== "cancelled" && t.status !== "failed",
    );
    expect(activeHaulTasks.length).toBeLessThanOrEqual(1);
  });

  it("skips items already on a stockpile tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const itemOnPile = makeItem({
      position_x: 12, position_y: 5, position_z: 0,
      held_by_dwarf_id: null,
      category: "raw_material",
      located_in_civ_id: "test-civ",
    });

    const tiles: FortressTile[] = [];
    for (let x = 3; x <= 15; x++) {
      tiles.push(grassTile(x, 5, 0));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      items: [itemOnPile],
      fortressTileOverrides: tiles,
      stockpileTiles: [makeStockpileTile(12, 5, 0)],
      ticks: 20,
    });

    const haulTasks = result.tasks.filter(
      t => t.task_type === "haul" && t.target_item_id === itemOnPile.id,
    );
    expect(haulTasks).toHaveLength(0);
  });
});
