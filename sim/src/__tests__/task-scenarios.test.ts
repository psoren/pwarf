import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeItem, makeStructure, makeSkill, makeMapTile } from "./test-helpers.js";

function stoneBlock() {
  return makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
function woodLog() {
  return makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "test-civ", held_by_dwarf_id: null });
}
import {
  WORK_MINE_BASE,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_BUILD_WELL,
  WORK_EAT,
  WORK_DRINK,
  WORK_FORAGE,
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  NEED_INTERRUPT_FOOD,
  NEED_INTERRUPT_DRINK,
  STARVATION_TICKS,
} from "@pwarf/shared";

// ============================================================
// Mining scenarios
// ============================================================

describe("mine task scenario", () => {
  it("completes and produces a stone block item", async () => {
    // Dwarf at (1,5) is adjacent to target (2,5)
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0 });
    const task = makeTask("mine", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_MINE_BASE + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const stoneBlock = result.items.find(i => i.material === "stone");
    expect(stoneBlock).toBeDefined();
    expect(stoneBlock?.name).toBe("Stone block");
  });

  it("marks the target tile as mined", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0 });
    const task = makeTask("mine", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_MINE_BASE + 5,
    });

    const minedTile = result.fortressTileOverrides.find(
      t => t.x === 2 && t.y === 5 && t.z === 0,
    );
    expect(minedTile?.is_mined).toBe(true);
    // Surface tiles (z=0) become grass; underground (z<0) become open_air
    expect(minedTile?.tile_type).toBe("grass");
  });

  it("dwarf moves to adjacent position before mining", async () => {
    // Dwarf starts 5 tiles away; pathfinding should move it to (1,5,0)
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const task = makeTask("mine", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    dwarf.current_task_id = task.id;

    // Extra ticks for travel (7 tiles manhattan) + work
    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_MINE_BASE + 20,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");
  });
});

// ============================================================
// Build wall scenarios
// ============================================================

describe("build_wall task scenario", () => {
  it("completes and creates a constructed_wall tile", async () => {
    const dwarf = makeDwarf({ position_x: 1, position_y: 5, position_z: 0 });
    const task = makeTask("build_wall", {
      assigned_dwarf_id: dwarf.id,
      target_x: 2,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WALL,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [stoneBlock()],
      ticks: WORK_BUILD_WALL + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const wallTile = result.fortressTileOverrides.find(
      t => t.x === 2 && t.y === 5 && t.z === 0,
    );
    expect(wallTile?.tile_type).toBe("constructed_wall");
  });
});

// ============================================================
// Build floor scenarios
// ============================================================

describe("build_floor task scenario", () => {
  it("completes and creates a constructed_floor tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("build_floor", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_FLOOR,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [stoneBlock()],
      ticks: WORK_BUILD_FLOOR + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const floorTile = result.fortressTileOverrides.find(
      t => t.x === 5 && t.y === 5 && t.z === 0,
    );
    expect(floorTile?.tile_type).toBe("constructed_floor");
  });
});

// ============================================================
// Build bed scenarios
// ============================================================

describe("build_bed task scenario", () => {
  it("completes and adds a bed structure", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("build_bed", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_BED,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [woodLog()],
      ticks: WORK_BUILD_BED + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const bed = result.structures.find(
      s => s.type === "bed" && s.position_x === 5 && s.position_y === 5,
    );
    expect(bed).toBeDefined();
    expect(bed?.completion_pct).toBe(100);
  });

  it("bed tile is marked in fortress overrides", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("build_bed", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_BED,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [woodLog()],
      ticks: WORK_BUILD_BED + 5,
    });

    const bedTile = result.fortressTileOverrides.find(
      t => t.x === 5 && t.y === 5 && t.z === 0,
    );
    expect(bedTile?.tile_type).toBe("bed");
  });
});

// ============================================================
// Eat/drink require food/water source scenarios
// ============================================================

describe("eat scenario", () => {
  it("dwarf eats food item on ground and food is removed", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 5, position_x: 0, position_y: 0, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 0, position_y: 0, position_z: 0 });
    const task = makeTask("eat", {
      assigned_dwarf_id: dwarf.id,
      target_x: 0,
      target_y: 0,
      target_z: 0,
      target_item_id: food.id,
      work_required: WORK_EAT,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      items: [food],
      ticks: WORK_EAT + 2,
    });

    expect(result.tasks[0]!.status).toBe("completed");
    expect(result.dwarves[0]!.need_food).toBeGreaterThan(NEED_INTERRUPT_FOOD);
    // Food item should be consumed
    expect(result.items.find(i => i.id === food.id)).toBeUndefined();
  });

  it("dwarf does NOT create eat task when no food is available", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 5 });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      ticks: 5,
    });

    const eatTasks = result.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(0);
    // Dwarf is still alive (just hungry, no starvation in 5 ticks)
    expect(result.dwarves[0]!.status).toBe("alive");
  });
});

describe("drink scenario", () => {
  it("dwarf drinks from well and drink need is restored", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 5, position_x: 0, position_y: 0, position_z: 0 });
    const well = makeStructure({ type: "well", position_x: 0, position_y: 0, position_z: 0 });
    const task = makeTask("drink", {
      assigned_dwarf_id: dwarf.id,
      target_x: 0,
      target_y: 0,
      target_z: 0,
      target_item_id: null, // wells have no item id
      work_required: WORK_DRINK,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      structures: [well],
      ticks: WORK_DRINK + 2,
    });

    expect(result.tasks[0]!.status).toBe("completed");
    expect(result.dwarves[0]!.need_drink).toBeGreaterThan(NEED_INTERRUPT_DRINK);
  });

  it("dwarf does NOT create drink task when no water source is available", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 5 });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      structures: [],
      ticks: 5,
    });

    const drinkTasks = result.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(0);
  });

  it("dwarf starves when food is not available", async () => {
    // High health so monster attacks don't kill the dwarf before starvation
    const dwarf = makeDwarf({ need_food: 0, need_drink: 80, health: 99999 });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      ticks: STARVATION_TICKS + 5,
    });

    expect(result.dwarves[0]!.status).toBe("dead");
    expect(result.dwarves[0]!.cause_of_death).toBe("starvation");
  });
});

// ============================================================
// Well autonomous drink scenarios
// ============================================================

describe("well autonomous drink scenario", () => {
  it("thirsty dwarf autonomously walks to well and drink need is restored", async () => {
    // Dwarf starts thirsty, well is at (5,0,0) — no pre-created drink task
    const dwarf = makeDwarf({
      need_drink: NEED_INTERRUPT_DRINK - 10,
      need_food: 80,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const well = makeStructure({
      type: "well",
      completion_pct: 100,
      position_x: 5,
      position_y: 0,
      position_z: 0,
    });

    // Give enough ticks: needSatisfaction creates drink task, dwarf walks 5 tiles, drinks
    const result = await runScenario({
      dwarves: [dwarf],
      structures: [well],
      ticks: WORK_DRINK + 20,
    });

    expect(result.dwarves[0]!.need_drink).toBeGreaterThan(NEED_INTERRUPT_DRINK);
  });

  it("thirsty dwarf does not die of thirst when a well is present", async () => {
    // High health so monster attacks don't kill the dwarf during this long scenario
    const dwarf = makeDwarf({
      need_drink: NEED_INTERRUPT_DRINK - 1,
      need_food: 80,
      health: 99999,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const well = makeStructure({
      type: "well",
      completion_pct: 100,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      structures: [well],
      ticks: STARVATION_TICKS + 10,
    });

    expect(result.dwarves[0]!.status).toBe("alive");
  });

  it("dwarf builds a well and then drinks from it", async () => {
    const dwarf = makeDwarf({
      need_drink: 80,
      need_food: 80,
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const buildSkill = makeSkill(dwarf.id, "building");
    const buildTask = makeTask("build_well", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WELL,
    });
    dwarf.current_task_id = buildTask.id;

    // Run long enough to build well, then let need_drink decay below threshold
    // and have the dwarf autonomously drink from the new well
    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill],
      tasks: [buildTask],
      items: [stoneBlock(), stoneBlock()],
      ticks: WORK_BUILD_WELL + 200,
    });

    // Well should be built
    const well = result.structures.find(s => s.type === "well" && s.completion_pct === 100);
    expect(well).toBeDefined();

    // Dwarf should still be alive (was able to drink from the well they built)
    expect(result.dwarves[0]!.status).toBe("alive");
  });
});

// ============================================================
// Foraging scenarios
// ============================================================

describe("forage scenario", () => {
  it("forage task produces a food item at the target tile", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("forage", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_FORAGE,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_FORAGE + 5,
    });

    expect(result.tasks[0]!.status).toBe("completed");
    const foodItem = result.items.find(i => i.category === "food");
    expect(foodItem).toBeDefined();
    expect(foodItem?.position_x).toBe(5);
    expect(foodItem?.position_y).toBe(5);
    expect(foodItem?.position_z).toBe(0);
  });

  it("forage task produces a wild mushroom or berries", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const task = makeTask("forage", {
      assigned_dwarf_id: dwarf.id,
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: WORK_FORAGE,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_FORAGE + 5,
    });

    const foodItem = result.items.find(i => i.category === "food");
    expect(['Wild mushroom', 'Berries']).toContain(foodItem?.name);
  });

  it("auto-forage creates a forage task when food is scarce and grass tile exists", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const grassTile = makeMapTile(3, 3, 0, 'grass');

    // No food items — should trigger auto-forage
    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      fortressTileOverrides: [grassTile],
      ticks: 5,
    });

    const forageTask = result.tasks.find(t => t.task_type === "forage");
    expect(forageTask).toBeDefined();
  });

  it("dwarf forages food from nearby grass tile when none exists in fortress", async () => {
    const dwarf = makeDwarf({
      need_food: NEED_INTERRUPT_FOOD + 10, // hungry but not crisis yet
      need_drink: 80,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const grassTile = makeMapTile(2, 0, 0, 'grass');

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      fortressTileOverrides: [grassTile],
      ticks: WORK_FORAGE + 20,
    });

    // At least one food item should now exist
    const food = result.items.filter(i => i.category === "food");
    expect(food.length).toBeGreaterThan(0);
  });

  it("does not create auto-forage task when food stock is sufficient", async () => {
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const grassTile = makeMapTile(3, 3, 0, 'grass');
    // Plenty of food — no foraging needed
    const food = Array.from({ length: 10 }, () =>
      makeItem({ category: 'food', position_x: 0, position_y: 0, position_z: 0 }),
    );

    const result = await runScenario({
      dwarves: [dwarf],
      items: food,
      fortressTileOverrides: [grassTile],
      ticks: 5,
    });

    const forageTasks = result.tasks.filter(t => t.task_type === "forage");
    expect(forageTasks).toHaveLength(0);
  });

  it("forage task completes and does not crash when dwarf has no foraging skill record", async () => {
    // XP is awarded internally — verify no crash and task completes cleanly
    const dwarf = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const task = makeTask("forage", {
      assigned_dwarf_id: dwarf.id,
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: WORK_FORAGE,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [], // no pre-existing skills — awardXp should create the record
      tasks: [task],
      ticks: WORK_FORAGE + 5,
    });

    expect(result.tasks[0]!.status).toBe("completed");
    expect(result.dwarves[0]!.status).toBe("alive");
  });
});
