import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeSkill, makeItem, makeMapTile } from "./test-helpers.js";
import { WORK_MINE_BASE, WORK_BUILD_FLOOR, XP_MINE, XP_BUILD, createFortressDeriver } from "@pwarf/shared";

const fortressDeriver = createFortressDeriver(42n, "test-civ", "plains");

describe("skill level-up scenario (issue #476)", () => {
  it("dwarf mining skill levels up after completing mine tasks end-to-end", async () => {
    // Start with 85 XP (level 0). After 1 mine completion (+15 XP = 100) → level 1.
    // This tests the full flow: job claiming → pathfinding → task execution → completion → XP award → level-up event.
    const dwarf = makeDwarf({
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const miningSkill = makeSkill(dwarf.id, "mining", 0, 85);

    // Single mine task — dwarf starts adjacent to target
    const task = makeTask("mine", {
      target_x: 257,
      target_y: 256,
      target_z: 0,
      work_required: WORK_MINE_BASE,
      status: "pending",
    });

    const tile = makeMapTile(257, 256, 0, "stone");

    // Food/drink nearby for survival
    const foodItems = [];
    for (let i = 0; i < 5; i++) {
      foodItems.push(makeItem({ category: "food", name: "Plump helmet", position_x: 256, position_y: 255, position_z: 0 }));
      foodItems.push(makeItem({ category: "drink", name: "Dwarven ale", position_x: 256, position_y: 255, position_z: 0 }));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks: [task],
      items: foodItems,
      fortressTileOverrides: [tile],
      fortressDeriver,
      ticks: WORK_MINE_BASE + 50, // Enough for claiming + execution + completion
    });

    const completedTask = result.tasks.find(t => t.task_type === "mine" && t.status === "completed");
    expect(completedTask).toBeDefined();

    const levelUpEvents = result.events.filter(
      e => e.category === "discovery"
        && e.event_data
        && (e.event_data as Record<string, unknown>).skill_name === "mining",
    );

    expect(levelUpEvents.length).toBe(1);
    const data = levelUpEvents[0].event_data as Record<string, unknown>;
    expect(data.new_level).toBe(1);
    expect(data.tier).toBe("Novice");
  });

  it("dwarf building skill levels up from repeated build tasks", async () => {
    // Start with 88 XP. After 1 build completion (+12 XP = 100) → level 1.
    const dwarf = makeDwarf({
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const buildingSkill = makeSkill(dwarf.id, "building", 0, 88);

    const task = makeTask("build_floor", {
      target_x: 256,
      target_y: 256,
      target_z: 0,
      work_required: WORK_BUILD_FLOOR,
      status: "pending",
    });

    const foodItems = [];
    for (let i = 0; i < 5; i++) {
      foodItems.push(makeItem({ category: "food", name: "Plump helmet", position_x: 256, position_y: 257, position_z: 0 }));
      foodItems.push(makeItem({ category: "drink", name: "Dwarven ale", position_x: 256, position_y: 257, position_z: 0 }));
    }
    // Stone block for build_floor
    foodItems.push(makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "test-civ", held_by_dwarf_id: null }));

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [buildingSkill],
      tasks: [task],
      items: foodItems,
      fortressDeriver,
      ticks: WORK_BUILD_FLOOR + 50,
    });

    const completedTask = result.tasks.find(t => t.task_type === "build_floor" && t.status === "completed");
    expect(completedTask).toBeDefined();

    const levelUpEvents = result.events.filter(
      e => e.category === "discovery"
        && e.event_data
        && (e.event_data as Record<string, unknown>).skill_name === "building",
    );
    expect(levelUpEvents.length).toBe(1);
    const data = levelUpEvents[0].event_data as Record<string, unknown>;
    expect(data.new_level).toBe(1);
    expect(data.tier).toBe("Novice");
  });

  it("XP accumulates without level-up when below threshold", async () => {
    // 0 XP + 3 mine completions = 45 XP — not enough for level 1 (needs 100)
    const dwarf = makeDwarf({
      position_x: 256,
      position_y: 256,
      position_z: 0,
      need_food: 100,
      need_drink: 100,
      need_sleep: 100,
    });

    const miningSkill = makeSkill(dwarf.id, "mining", 0, 0);

    const tasks = [];
    const tiles = [];
    for (let i = 0; i < 3; i++) {
      const task = makeTask("mine", {
        target_x: 257,
        target_y: 256 + i,
        target_z: 0,
        work_required: WORK_MINE_BASE,
        status: "pending",
      });
      tasks.push(task);
      tiles.push(makeMapTile(257, 256 + i, 0, "stone"));
    }

    // Pre-claim first task
    tasks[0].status = "claimed";
    tasks[0].assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = tasks[0].id;

    const foodItems = [];
    for (let i = 0; i < 10; i++) {
      foodItems.push(makeItem({ category: "food", name: "Plump helmet", position_x: 256, position_y: 255, position_z: 0 }));
      foodItems.push(makeItem({ category: "drink", name: "Dwarven ale", position_x: 256, position_y: 255, position_z: 0 }));
    }

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [miningSkill],
      tasks,
      items: foodItems,
      fortressTileOverrides: tiles,
      fortressDeriver,
      ticks: 1500,
    });

    const completedMineTasks = result.tasks.filter(
      t => t.task_type === "mine" && t.status === "completed",
    );
    expect(completedMineTasks.length).toBe(3);

    // No level-up event (45 XP < 100 threshold)
    const levelUpEvents = result.events.filter(
      e => e.category === "discovery"
        && e.event_data
        && (e.event_data as Record<string, unknown>).skill_name === "mining",
    );
    expect(levelUpEvents.length).toBe(0);
  });
});
