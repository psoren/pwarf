import { describe, it, expect } from "vitest";
import { runScenario } from "../run-scenario.js";
import { makeDwarf, makeTask, makeMapTile, makeStructure, makeSkill } from "./test-helpers.js";
import { WORK_DECONSTRUCT } from "@pwarf/shared";

describe("deconstruct scenario", () => {
  it("completes a deconstruct task on a constructed_wall and restores tile to open_air", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 4, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building");
    const task = makeTask("deconstruct", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_DECONSTRUCT,
    });
    dwarf.current_task_id = task.id;

    const wallTile = makeMapTile(5, 5, 0, "constructed_wall");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [wallTile],
      ticks: WORK_DECONSTRUCT + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const tile = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(tile?.tile_type).toBe("open_air");
  });

  it("completes a deconstruct task on a constructed_floor", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 4, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building");
    const task = makeTask("deconstruct", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_DECONSTRUCT,
    });
    dwarf.current_task_id = task.id;

    const floorTile = makeMapTile(5, 5, 0, "constructed_floor");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [floorTile],
      ticks: WORK_DECONSTRUCT + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const tile = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(tile?.tile_type).toBe("open_air");
  });

  it("removes the structure record when deconstructing a bed", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 4, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building");
    const task = makeTask("deconstruct", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_DECONSTRUCT,
    });
    dwarf.current_task_id = task.id;

    const bedTile = makeMapTile(5, 5, 0, "bed");
    const bedStructure = makeStructure({
      type: "bed",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [bedTile],
      structures: [bedStructure],
      ticks: WORK_DECONSTRUCT + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");

    const tile = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(tile?.tile_type).toBe("open_air");

    const remainingBed = result.structures.find(s => s.id === bedStructure.id);
    expect(remainingBed).toBeUndefined();
  });

  it("awards building XP on completion", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 4, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    const task = makeTask("deconstruct", {
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_DECONSTRUCT,
    });
    dwarf.current_task_id = task.id;

    const wallTile = makeMapTile(5, 5, 0, "constructed_wall");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [wallTile],
      ticks: WORK_DECONSTRUCT + 5,
    });

    const completedTask = result.tasks.find(t => t.id === task.id);
    expect(completedTask?.status).toBe("completed");
  });

  it("idle dwarf picks up a pending deconstruct task and completes it", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 4, position_z: 0 });
    const skill = makeSkill(dwarf.id, "building", 1);

    // Task is pending with no assignee — simulates player designation
    const task = makeTask("deconstruct", {
      status: "pending",
      assigned_dwarf_id: null,
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: WORK_DECONSTRUCT,
    });

    const wallTile = makeMapTile(5, 5, 0, "constructed_wall");

    const result = await runScenario({
      dwarves: [dwarf],
      dwarfSkills: [skill],
      tasks: [task],
      fortressTileOverrides: [wallTile],
      ticks: WORK_DECONSTRUCT + 20,
    });

    // Dwarf should have picked up and completed the task
    const completedTask = result.tasks.find(
      t => t.task_type === "deconstruct" && t.status === "completed",
    );
    expect(completedTask).toBeDefined();

    // Tile should be reverted to open_air
    const tile = result.fortressTileOverrides.find(t => t.x === 5 && t.y === 5);
    expect(tile?.tile_type).toBe("open_air");
  });
});
