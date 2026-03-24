import { describe, it, expect } from "vitest";
import { BUILDING_COSTS } from "@pwarf/shared";
import { completeTask } from "../phases/task-completion.js";
import { createTask } from "../task-helpers.js";
import { makeDwarf, makeItem, makeContext, makeSkill } from "./test-helpers.js";

describe("building resource costs", () => {
  it("build_wall consumes 1 stone block", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 5, position_y: 5, position_z: 0 }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 6, position_y: 6, position_z: 0 }),
      ],
    });

    const task = createTask(ctx, {
      task_type: "build_wall",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 40,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("completed");
    // 1 stone consumed, 1 remaining
    const stones = ctx.state.items.filter(i => i.category === "raw_material" && i.material === "stone");
    expect(stones).toHaveLength(1);
  });

  it("build_wall fails without stone blocks and reverts to pending", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [], // no resources
    });

    const task = createTask(ctx, {
      task_type: "build_wall",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 40,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("pending");
    expect(task.assigned_dwarf_id).toBeNull();
    expect(dwarf.current_task_id).toBeNull();
    // Should emit a "not enough resources" event
    const resourceEvents = ctx.state.pendingEvents.filter(e => e.description.includes("not enough resources"));
    expect(resourceEvents).toHaveLength(1);
  });

  it("build_bed consumes 1 wood log", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [
        makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 5, position_y: 5, position_z: 0 }),
      ],
    });

    const task = createTask(ctx, {
      task_type: "build_bed",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 30,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("completed");
    const wood = ctx.state.items.filter(i => i.category === "raw_material" && i.material === "wood");
    expect(wood).toHaveLength(0);
  });

  it("build_well consumes 2 stone blocks", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 5, position_y: 5, position_z: 0 }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 6, position_y: 6, position_z: 0 }),
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 7, position_y: 7, position_z: 0 }),
      ],
    });

    const task = createTask(ctx, {
      task_type: "build_well",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 60,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("completed");
    const stones = ctx.state.items.filter(i => i.category === "raw_material" && i.material === "stone");
    expect(stones).toHaveLength(1);
  });

  it("build_well fails with only 1 stone block (needs 2)", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null, position_x: 5, position_y: 5, position_z: 0 }),
      ],
    });

    const task = createTask(ctx, {
      task_type: "build_well",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 60,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("pending");
    // Stone should NOT be consumed
    const stones = ctx.state.items.filter(i => i.category === "raw_material" && i.material === "stone");
    expect(stones).toHaveLength(1);
  });

  it("does not consume items held by dwarves", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({
      dwarves: [dwarf],
      skills: [makeSkill(dwarf.id, "building", 1)],
      items: [
        // This stone is held by a dwarf — should not be consumed
        makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: dwarf.id }),
      ],
    });

    const task = createTask(ctx, {
      task_type: "build_wall",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 40,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("pending");
    // Stone should still be held
    expect(ctx.state.items).toHaveLength(1);
  });

  it("BUILDING_COSTS defines costs for all build task types", () => {
    expect(BUILDING_COSTS.build_wall).toBeDefined();
    expect(BUILDING_COSTS.build_floor).toBeDefined();
    expect(BUILDING_COSTS.build_bed).toBeDefined();
    expect(BUILDING_COSTS.build_well).toBeDefined();
    expect(BUILDING_COSTS.build_mushroom_garden).toBeDefined();
  });
});
