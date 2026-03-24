import { describe, it, expect } from "vitest";
import { FOOD_RESTORE_AMOUNT, DRINK_RESTORE_AMOUNT, FLOOR_SLEEP_STRESS, MAX_NEED } from "@pwarf/shared";
import { completeTask } from "../phases/task-completion.js";
import { createTask } from "../task-helpers.js";
import { makeDwarf, makeSkill, makeItem, makeContext, makeStructure } from "./test-helpers.js";

describe("completeTask", () => {
  it("marks task completed and clears dwarf assignment", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(task.status).toBe("completed");
    expect(task.completed_at).not.toBeNull();
    expect(dwarf.current_task_id).toBeNull();
  });

  it("fires completion event for player tasks", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "haul",
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    const events = ctx.state.pendingEvents.filter(e => e.description.includes("finished"));
    expect(events).toHaveLength(1);
  });

  it("does not fire event for autonomous tasks (eat/drink/sleep)", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "eat",
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    const events = ctx.state.pendingEvents.filter(e => e.description.includes("finished"));
    expect(events).toHaveLength(0);
  });

  it("eating from infinite source restores need without consuming items", () => {
    const dwarf = makeDwarf({ need_food: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "eat",
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(dwarf.need_food).toBe(Math.min(MAX_NEED, 20 + FOOD_RESTORE_AMOUNT));
  });

  it("eating with target item still consumes it", () => {
    const dwarf = makeDwarf({ need_food: 20 });
    const food = makeItem({ category: "food" });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });
    const task = createTask(ctx, {
      task_type: "eat",
      target_item_id: food.id,
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(dwarf.need_food).toBe(Math.min(MAX_NEED, 20 + FOOD_RESTORE_AMOUNT));
    expect(ctx.state.items.find(i => i.id === food.id)).toBeUndefined();
  });

  it("drinking from infinite source restores need without consuming items", () => {
    const dwarf = makeDwarf({ need_drink: 15 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "drink",
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(dwarf.need_drink).toBe(Math.min(MAX_NEED, 15 + DRINK_RESTORE_AMOUNT));
  });

  it("sleeping completion does not add extra sleep (gradual restore happens in task-execution)", () => {
    const dwarf = makeDwarf({ need_sleep: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "sleep",
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    // Sleep restoration is gradual — completeSleep no longer adds anything
    expect(dwarf.need_sleep).toBe(10);
  });

  it("mining at z=0 creates stone item and grass tile", () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "mining", 0);
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill] });
    const task = createTask(ctx, {
      task_type: "mine",
      target_x: 10,
      target_y: 10,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    const stones = ctx.state.items.filter(i => i.category === "raw_material");
    expect(stones).toHaveLength(1);
    // Surface mining (z=0) produces grass, not open_air
    expect(ctx.state.fortressTileOverrides.get("10,10,0")!.tile_type).toBe("grass");
  });

  it("build_wall creates constructed_wall tile", () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "building", 0, 0);
    const stone = makeItem({ name: "Stone block", category: "raw_material", material: "stone", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], items: [stone] });
    const task = createTask(ctx, {
      task_type: "build_wall",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(ctx.state.fortressTileOverrides.get("5,5,0")!.tile_type).toBe("constructed_wall");
    expect(ctx.state.fortressTileOverrides.get("5,5,0")!.material).toBe("stone");
  });

  it("farm_harvest creates a food item", () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "farming", 0);
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill] });
    const task = createTask(ctx, {
      task_type: "farm_harvest",
      target_x: 0,
      target_y: 0,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    const food = ctx.state.items.filter(i => i.category === "food");
    expect(food).toHaveLength(1);
    expect(food[0]!.name).toBe("Plump helmet");
  });
});

describe("bed sleep completion", () => {
  it("floor sleep applies stress penalty", () => {
    const dwarf = makeDwarf({ need_sleep: 10, stress_level: 20 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "sleep",
      work_required: 1,
      target_item_id: null,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(dwarf.stress_level).toBe(20 + FLOOR_SLEEP_STRESS);
  });

  it("bed sleep does not apply stress penalty and releases bed", () => {
    const bed = makeStructure({ occupied_by_dwarf_id: "some-dwarf" });
    const dwarf = makeDwarf({ need_sleep: 10, stress_level: 20 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [bed] });
    const task = createTask(ctx, {
      task_type: "sleep",
      work_required: 1,
      target_item_id: bed.id,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    expect(dwarf.stress_level).toBe(20);
    expect(bed.occupied_by_dwarf_id).toBeNull();
  });

  it("build_bed creates bed structure and bed tile", () => {
    const dwarf = makeDwarf();
    const skill = makeSkill(dwarf.id, "building", 0);
    const wood = makeItem({ name: "Wood log", category: "raw_material", material: "wood", located_in_civ_id: "civ-1", held_by_dwarf_id: null });
    const ctx = makeContext({ dwarves: [dwarf], skills: [skill], items: [wood] });
    const task = createTask(ctx, {
      task_type: "build_bed",
      target_x: 5,
      target_y: 5,
      target_z: 0,
      work_required: 1,
    });
    task.status = "in_progress";
    dwarf.current_task_id = task.id;

    completeTask(dwarf, task, ctx);

    const beds = ctx.state.structures.filter(s => s.type === "bed");
    expect(beds).toHaveLength(1);
    expect(beds[0]!.position_x).toBe(5);
    expect(beds[0]!.position_y).toBe(5);
    expect(ctx.state.fortressTileOverrides.get("5,5,0")!.tile_type).toBe("bed");
  });
});
