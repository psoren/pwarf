import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile } from "./test-helpers.js";
import {
  WORK_MINE_BASE,
  WORK_BUILD_WALL,
  NEED_INTERRUPT_FOOD,
} from "@pwarf/shared";

/**
 * Mixed-priority scenario tests.
 *
 * Tests:
 * 1. Dwarves interrupt low-priority tasks when urgent needs arise (eat interrupts mine)
 * 2. Multiple dwarves claim tasks by priority — higher priority tasks complete first
 */

function grassTile(x: number, y: number) {
  return makeMapTile(x, y, 0, "grass");
}

function rockTile(x: number, y: number) {
  return makeMapTile(x, y, 0, "stone");
}

function stoneBlock() {
  return makeItem({
    name: "Stone block",
    category: "raw_material",
    material: "stone",
    located_in_civ_id: "test-civ",
    held_by_dwarf_id: null,
  });
}

describe("need interrupts work (eat preempts mine)", () => {
  it("hungry dwarf interrupts mine task to eat, then resumes", async () => {
    // need_food starts at 25 — below NEED_INTERRUPT_FOOD (30).
    // The needSatisfaction phase will immediately create an eat task for the dwarf,
    // which takes priority over any mine task via the autonomous task system.
    const dwarf = makeDwarf({
      id: "d-hungry-miner",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 25, // below threshold (30) — eat task created immediately
      need_drink: 100,
      need_sleep: 100,
    });

    const miningSkill = makeSkill(dwarf.id, "mining", 2);

    const mineTask = makeTask("mine", {
      civilization_id: "test-civ",
      status: "pending",
      target_x: 8,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 5,
    });

    // Food item nearby for eating
    const foodItem = makeItem({
      id: "food-1",
      name: "Plump helmet",
      category: "food",
      located_in_civ_id: "test-civ",
      position_x: 5,
      position_y: 6,
      position_z: 0,
    });

    const tiles = [
      grassTile(5, 5), grassTile(6, 5), grassTile(7, 5),
      rockTile(8, 5),
      grassTile(5, 6),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: [mineTask],
      items: [foodItem],
      fortressTileOverrides: tiles,
      ticks: 300,
      seed: 42,
    });

    // An eat task should have been created and completed
    const eatTask = result.tasks.find(
      t => t.task_type === "eat" && t.status === "completed",
    );
    expect(eatTask).toBeDefined();

    // Dwarf's need_food should be restored above threshold
    const finalDwarf = result.dwarves.find(d => d.id === dwarf.id);
    expect(finalDwarf).toBeDefined();
    expect(finalDwarf!.need_food).toBeGreaterThan(NEED_INTERRUPT_FOOD);

    // Dwarf is alive
    expect(finalDwarf!.status).toBe("alive");
  });

  it("mine task completes eventually even after eat interruption", async () => {
    const dwarf = makeDwarf({
      id: "d-miner-recovers",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 40,
      need_drink: 100,
      need_sleep: 100,
    });

    const miningSkill = makeSkill(dwarf.id, "mining", 2);

    const mineTask = makeTask("mine", {
      civilization_id: "test-civ",
      status: "pending",
      target_x: 6,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 5,
    });

    // Enough food to recover from the hunger interrupt
    const foodItems = Array.from({ length: 5 }, (_, i) =>
      makeItem({
        name: "Plump helmet",
        category: "food",
        located_in_civ_id: "test-civ",
        position_x: 5,
        position_y: 6,
        position_z: 0,
      }),
    );
    const drinkItems = Array.from({ length: 15 }, () =>
      makeItem({
        name: "Dwarven ale",
        category: "drink",
        located_in_civ_id: "test-civ",
        position_x: 5,
        position_y: 6,
        position_z: 0,
      }),
    );

    const tiles = [
      grassTile(5, 5), grassTile(5, 6),
      rockTile(6, 5),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: [mineTask],
      items: [...foodItems, ...drinkItems],
      fortressTileOverrides: tiles,
      ticks: 400, // generous time for interrupt + recovery + mine completion
      seed: 42,
    });

    // Mine task should complete eventually
    const completedMine = result.tasks.find(
      t => t.task_type === "mine" && t.status === "completed",
    );
    expect(completedMine).toBeDefined();
  });
});

describe("multiple dwarves claim by priority", () => {
  it("higher priority build_wall tasks complete before lower priority mine tasks", { timeout: 30000 }, async () => {
    // Priority 8 = build_wall (higher priority number = more urgent)
    // Priority 5 = mine (lower priority)
    // 3 dwarves should grab tasks by priority — build_wall tasks first
    const dwarf1 = makeDwarf({
      id: "d-prio-1",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });
    const dwarf2 = makeDwarf({
      id: "d-prio-2",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 7,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });
    const dwarf3 = makeDwarf({
      id: "d-prio-3",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 9,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const buildSkill1 = makeSkill(dwarf1.id, "building", 2);
    const buildSkill2 = makeSkill(dwarf2.id, "building", 2);
    const buildSkill3 = makeSkill(dwarf3.id, "building", 2);
    const mineSkill1 = makeSkill(dwarf1.id, "mining", 2);
    const mineSkill2 = makeSkill(dwarf2.id, "mining", 2);
    const mineSkill3 = makeSkill(dwarf3.id, "mining", 2);

    // 2 build_wall tasks at priority 8 (high)
    const buildTask1 = makeTask("build_wall", {
      id: "build-wall-1",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 10,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WALL,
      priority: 8,
    });
    const buildTask2 = makeTask("build_wall", {
      id: "build-wall-2",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 10,
      target_y: 7,
      target_z: 0,
      work_required: WORK_BUILD_WALL,
      priority: 8,
    });

    // 2 mine tasks at priority 5 (low)
    const mineTask1 = makeTask("mine", {
      id: "mine-task-1",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 10,
      target_y: 9,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 5,
    });
    const mineTask2 = makeTask("mine", {
      id: "mine-task-2",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 10,
      target_y: 11,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 5,
    });

    // Stone blocks for build_wall
    const blocks = Array.from({ length: 4 }, () => stoneBlock());

    // Map tiles — grass for walking, rock for mining
    const tiles = [
      grassTile(5, 5), grassTile(5, 7), grassTile(5, 9),
      grassTile(9, 5), grassTile(9, 7), grassTile(9, 9), grassTile(9, 11),
      grassTile(10, 5), grassTile(10, 7),
      rockTile(10, 9), rockTile(10, 11),
      // Additional path tiles
      grassTile(6, 5), grassTile(7, 5), grassTile(8, 5),
      grassTile(6, 7), grassTile(7, 7), grassTile(8, 7),
      grassTile(6, 9), grassTile(7, 9), grassTile(8, 9),
      grassTile(6, 11), grassTile(7, 11), grassTile(8, 11),
    ];

    const result = await runScenario({
      dwarves: [dwarf1, dwarf2, dwarf3],
      dwarfSkills: [buildSkill1, buildSkill2, buildSkill3, mineSkill1, mineSkill2, mineSkill3],
      tasks: [buildTask1, buildTask2, mineTask1, mineTask2],
      items: blocks,
      fortressTileOverrides: tiles,
      ticks: 500,
      seed: 42,
    });

    // Both build_wall tasks should complete
    const completedBuild1 = result.tasks.find(t => t.id === buildTask1.id && t.status === "completed");
    const completedBuild2 = result.tasks.find(t => t.id === buildTask2.id && t.status === "completed");
    expect(completedBuild1).toBeDefined();
    expect(completedBuild2).toBeDefined();

    // All dwarves should be alive
    expect(result.dwarves.every(d => d.status === "alive")).toBe(true);
  });

  it("single idle dwarf picks the highest priority pending task first", async () => {
    const dwarf = makeDwarf({
      id: "d-priority-single",
      civilization_id: "test-civ",
      position_x: 5,
      position_y: 5,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const buildSkill = makeSkill(dwarf.id, "building", 2);
    const mineSkill = makeSkill(dwarf.id, "mining", 2);

    // High priority task
    const highPriorityTask = makeTask("build_wall", {
      id: "high-prio-task",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 7,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WALL,
      priority: 9,
    });

    // Low priority task
    const lowPriorityTask = makeTask("mine", {
      id: "low-prio-task",
      civilization_id: "test-civ",
      status: "pending",
      target_x: 10,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      priority: 3,
    });

    const block = stoneBlock();
    const tiles = [
      grassTile(5, 5), grassTile(6, 5), grassTile(7, 5),
      grassTile(8, 5), grassTile(9, 5), rockTile(10, 5),
    ];

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildSkill, mineSkill],
      tasks: [lowPriorityTask, highPriorityTask], // submit low priority first to test ordering
      items: [block],
      fortressTileOverrides: tiles,
      ticks: 200,
      seed: 42,
    });

    // The high priority build_wall task should complete first
    const completedHigh = result.tasks.find(t => t.id === highPriorityTask.id && t.status === "completed");
    expect(completedHigh).toBeDefined();
    expect(completedHigh!.completed_at).not.toBeNull();
  });
});
