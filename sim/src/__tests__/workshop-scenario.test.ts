import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeSkill, makeItem, makeMapTile, makeStructure } from "./test-helpers.js";

/** Helper: make a 10×10 grass map */
function makeGrassMap() {
  return Array.from({ length: 10 }, (_, x) =>
    Array.from({ length: 10 }, (_, y) => makeMapTile(x, y, 0, "grass")),
  ).flat();
}

/** Helper: make a still at (5,5,0) belonging to the test-civ */
function makeTestStill() {
  return makeStructure({
    type: "still",
    civilization_id: "test-civ",
    completion_pct: 100,
    occupied_by_dwarf_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
  });
}

/** Helper: make a kitchen at (5,5,0) belonging to the test-civ */
function makeTestKitchen() {
  return makeStructure({
    type: "kitchen",
    civilization_id: "test-civ",
    completion_pct: 100,
    occupied_by_dwarf_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
  });
}

// ---------------------------------------------------------------------------
// Auto-brew requires a still
// ---------------------------------------------------------------------------

describe("auto-brew workshop requirement", () => {
  it("does NOT create a brew task when no still exists", async () => {
    const dwarf = makeDwarf({
      name: "Brewer",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "brewing", 3)],
      items: [plant],
      structures: [], // no still
      tasks: [],
      fortressTileOverrides: makeGrassMap(),
      ticks: 200,
      seed: 42,
    });

    const brewTasks = result.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.length).toBe(0);
  });

  it("creates a brew task targeting the still position when a still exists", async () => {
    const dwarf = makeDwarf({
      name: "Brewer",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const still = makeTestStill();

    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = [
      ...makeGrassMap(),
      makeMapTile(5, 5, 0, "still"),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "brewing", 3)],
      items: [plant],
      structures: [still],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
    });

    const brewTasks = result.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.length).toBeGreaterThan(0);

    // Task should target the still's position
    const task = brewTasks[0]!;
    expect(task.target_x).toBe(5);
    expect(task.target_y).toBe(5);
    expect(task.target_z).toBe(0);
    // target_item_id should be the still's structure ID
    expect(task.target_item_id).toBe(still.id);
  });

  it("does NOT create a brew task when still exists but no plant ingredients are nearby", async () => {
    const dwarf = makeDwarf({
      name: "Brewer",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const still = makeTestStill();

    // Plant is far away (beyond radius of 5): still at (5,5), plant at (0,0) = distance 10
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 0,
      position_y: 0,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = [
      ...makeGrassMap(),
      makeMapTile(5, 5, 0, "still"),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "brewing", 3)],
      items: [plant],
      structures: [still],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 100,
      seed: 42,
    });

    const brewTasks = result.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Auto-cook requires a kitchen
// ---------------------------------------------------------------------------

describe("auto-cook workshop requirement", () => {
  it("does NOT create a cook task when no kitchen exists", async () => {
    const dwarf = makeDwarf({
      name: "Cook",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const food = makeItem({
      category: "food",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "cooking", 3)],
      items: [food],
      structures: [], // no kitchen
      tasks: [],
      fortressTileOverrides: makeGrassMap(),
      ticks: 200,
      seed: 42,
    });

    const cookTasks = result.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks.length).toBe(0);
  });

  it("creates a cook task targeting the kitchen when kitchen + nearby food exist", async () => {
    const dwarf = makeDwarf({
      name: "Cook",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const kitchen = makeTestKitchen();

    const food = makeItem({
      category: "food",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const tiles = [
      ...makeGrassMap(),
      makeMapTile(5, 5, 0, "kitchen"),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "cooking", 3)],
      items: [food],
      structures: [kitchen],
      tasks: [],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
    });

    const cookTasks = result.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks.length).toBeGreaterThan(0);

    const task = cookTasks[0]!;
    expect(task.target_x).toBe(5);
    expect(task.target_y).toBe(5);
    expect(task.target_z).toBe(0);
    expect(task.target_item_id).toBe(kitchen.id);
  });
});

// ---------------------------------------------------------------------------
// Build workshop tasks complete correctly
// ---------------------------------------------------------------------------

describe("build workshop tasks", () => {
  it("building a still creates a still structure and tile", async () => {
    const dwarf = makeDwarf({
      name: "Builder",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    // Wood material needed for build_still cost
    const wood = makeItem({
      name: "Wood log",
      category: "raw_material",
      material: "wood",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      located_in_civ_id: "test-civ",
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [makeSkill(dwarf.id, "building", 3)],
      items: [wood],
      tasks: [{
        id: "build-still-task",
        civilization_id: "test-civ",
        task_type: "build_still",
        status: "pending",
        priority: 5,
        assigned_dwarf_id: null,
        target_x: 5,
        target_y: 5,
        target_z: 0,
        target_item_id: null,
        work_progress: 0,
        work_required: 50,
        created_at: new Date().toISOString(),
        completed_at: null,
      }],
      fortressTileOverrides: makeGrassMap(),
      ticks: 300,
      seed: 42,
    });

    // Should have a completed build_still task
    const task = result.tasks.find(t => t.task_type === "build_still");
    expect(task?.status).toBe("completed");

    // Should have a still structure
    const still = result.structures.find(s => s.type === "still");
    expect(still).toBeDefined();
    expect(still?.completion_pct).toBe(100);

    // Should have a still tile placed
    const stillTile = result.fortressTileOverrides.find(t => t.tile_type === "still");
    expect(stillTile).toBeDefined();
  });
});
