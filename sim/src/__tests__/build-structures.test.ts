import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask } from "./test-helpers.js";
import { WORK_BUILD_WELL, WORK_BUILD_MUSHROOM_GARDEN } from "@pwarf/shared";

describe("build_well scenario", () => {
  it("completes and adds a well structure", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("build_well", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WELL,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_BUILD_WELL + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const well = result.structures.find(s => s.type === "well");
    expect(well).toBeDefined();
    expect(well?.completion_pct).toBe(100);
    expect(well?.position_x).toBe(5);
    expect(well?.position_y).toBe(5);
  });

  it("places a well tile in fortress overrides", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const task = makeTask("build_well", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_BUILD_WELL,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_BUILD_WELL + 5,
    });

    const wellTile = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(wellTile?.tile_type).toBe("well");
  });
});

describe("build_mushroom_garden scenario", () => {
  it("completes and adds a mushroom_garden structure", async () => {
    const dwarf = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    const task = makeTask("build_mushroom_garden", {
      assigned_dwarf_id: dwarf.id,
      target_x: 3,
      target_y: 3,
      target_z: 0,
      work_required: WORK_BUILD_MUSHROOM_GARDEN,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_BUILD_MUSHROOM_GARDEN + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const garden = result.structures.find(s => s.type === "mushroom_garden");
    expect(garden).toBeDefined();
    expect(garden?.completion_pct).toBe(100);
  });

  it("places a mushroom_garden tile in fortress overrides", async () => {
    const dwarf = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    const task = makeTask("build_mushroom_garden", {
      assigned_dwarf_id: dwarf.id,
      target_x: 3,
      target_y: 3,
      target_z: 0,
      work_required: WORK_BUILD_MUSHROOM_GARDEN,
    });
    dwarf.current_task_id = task.id;

    const result = await runScenario({
      dwarves: [dwarf],
      tasks: [task],
      ticks: WORK_BUILD_MUSHROOM_GARDEN + 5,
    });

    const gardenTile = result.fortressTileOverrides.find(t => t.x === 3 && t.y === 3);
    expect(gardenTile?.tile_type).toBe("mushroom_garden");
  });
});
