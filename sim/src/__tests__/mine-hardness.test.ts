import { describe, it, expect } from "vitest";
import { getTileHardness } from "../phases/task-execution.js";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeMapTile } from "./test-helpers.js";
import {
  HARDNESS_SOIL,
  HARDNESS_STONE,
  HARDNESS_ORE,
  HARDNESS_GEM,
  HARDNESS_IGNITE,
  WORK_MINE_BASE,
} from "@pwarf/shared";

// ============================================================
// getTileHardness unit tests
// ============================================================

describe("getTileHardness", () => {
  it("soil has low hardness (fast to mine)", () => {
    expect(getTileHardness("soil")).toBe(HARDNESS_SOIL);
  });

  it("rock/default has standard hardness", () => {
    expect(getTileHardness("rock")).toBe(HARDNESS_STONE);
    expect(getTileHardness("stone")).toBe(HARDNESS_STONE);
    expect(getTileHardness(null)).toBe(HARDNESS_STONE);
    expect(getTileHardness("open_air")).toBe(HARDNESS_STONE);
  });

  it("ore is harder than stone", () => {
    expect(getTileHardness("ore")).toBe(HARDNESS_ORE);
    expect(HARDNESS_ORE).toBeGreaterThan(HARDNESS_STONE);
  });

  it("gem is harder than ore", () => {
    expect(getTileHardness("gem")).toBe(HARDNESS_GEM);
    expect(HARDNESS_GEM).toBeGreaterThan(HARDNESS_ORE);
  });

  it("lava_stone and cavern_wall have highest hardness", () => {
    expect(getTileHardness("lava_stone")).toBe(HARDNESS_IGNITE);
    expect(getTileHardness("cavern_wall")).toBe(HARDNESS_IGNITE);
    expect(HARDNESS_IGNITE).toBeGreaterThan(HARDNESS_GEM);
  });
});

// ============================================================
// Scenario tests: hardness affects completion time
// ============================================================

describe("mine hardness scenario", () => {
  it("soil mines faster than rock (completes in fewer ticks)", async () => {
    // Soil tile — hardness 0.3 → effective work = WORK_MINE_BASE * 0.3 ticks
    const soilTicks = Math.ceil(WORK_MINE_BASE * HARDNESS_SOIL) + 2;

    const dwarf1 = makeDwarf({ id: "d1", position_x: 1, position_y: 0, position_z: 0 });
    const task1 = makeTask("mine", {
      assigned_dwarf_id: "d1",
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    dwarf1.current_task_id = task1.id;

    const soilTile = makeMapTile(2, 0, 0, "soil");

    const result = await runScenario({
      dwarves: [dwarf1],
      tasks: [task1],
      fortressTileOverrides: [soilTile],
      ticks: soilTicks,
    });

    const task = result.tasks.find(t => t.id === task1.id);
    expect(task?.status).toBe("completed");
  });

  it("soil does NOT complete in fewer ticks than the standard stone would allow", async () => {
    // With stone hardness (default), would need WORK_MINE_BASE ticks.
    // With soil hardness (0.3), needs only WORK_MINE_BASE * 0.3 ≈ 30 ticks.
    // If we run for only 30 ticks, soil should be done but stone would not be.
    const soilTicks = Math.ceil(WORK_MINE_BASE * HARDNESS_SOIL) + 2;

    // Soil dwarf should complete
    const soilDwarf = makeDwarf({ id: "soil", position_x: 1, position_y: 0, position_z: 0 });
    const soilTask = makeTask("mine", {
      id: "t-soil",
      assigned_dwarf_id: "soil",
      target_x: 2,
      target_y: 0,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    soilDwarf.current_task_id = soilTask.id;

    // Stone dwarf (default tile = stone hardness) should NOT complete in same ticks
    const stoneDwarf = makeDwarf({ id: "stone", position_x: 1, position_y: 5, position_z: 0 });
    const stoneTask = makeTask("mine", {
      id: "t-stone",
      assigned_dwarf_id: "stone",
      target_x: 2,
      target_y: 5,
      target_z: 0,
      work_required: WORK_MINE_BASE,
    });
    stoneDwarf.current_task_id = stoneTask.id;

    const result = await runScenario({
      dwarves: [soilDwarf, stoneDwarf],
      tasks: [soilTask, stoneTask],
      fortressTileOverrides: [makeMapTile(2, 0, 0, "soil")],
      ticks: soilTicks,
    });

    const finishedSoil = result.tasks.find(t => t.id === soilTask.id);
    const finishedStone = result.tasks.find(t => t.id === stoneTask.id);

    expect(finishedSoil?.status).toBe("completed");
    expect(finishedStone?.status).not.toBe("completed"); // stone takes longer
  });
});
