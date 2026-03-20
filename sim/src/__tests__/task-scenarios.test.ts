import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeItem, makeStructure } from "./test-helpers.js";
import {
  WORK_MINE_BASE,
  WORK_BUILD_WALL,
  WORK_BUILD_FLOOR,
  WORK_BUILD_BED,
  WORK_EAT,
  WORK_DRINK,
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
    const dwarf = makeDwarf({ need_food: 0, need_drink: 80 });

    const result = await runScenario({
      dwarves: [dwarf],
      items: [],
      ticks: STARVATION_TICKS + 5,
    });

    expect(result.dwarves[0]!.status).toBe("dead");
    expect(result.dwarves[0]!.cause_of_death).toBe("starvation");
  });
});
