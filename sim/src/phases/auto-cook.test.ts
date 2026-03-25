import { describe, it, expect } from "vitest";
import { autoCookPhase } from "./auto-cook.js";
import { makeItem, makeTask, makeContext, makeStructure } from "../__tests__/test-helpers.js";
import { MIN_COOK_STOCK } from "@pwarf/shared";

/** Helper: make an unoccupied kitchen at (5,5,0) */
function makeKitchen() {
  return makeStructure({
    type: "kitchen",
    civilization_id: "civ-1",
    completion_pct: 100,
    occupied_by_dwarf_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
  });
}

/** Make a raw food item on the ground at a given position */
function rawFoodAt(x: number, y: number, z: number) {
  return makeItem({
    category: "food",
    material: "plant",
    held_by_dwarf_id: null,
    position_x: x,
    position_y: y,
    position_z: z,
  });
}

/** Make a cooked meal item on the ground */
function cookedFoodAt(x: number, y: number, z: number) {
  return makeItem({
    category: "food",
    material: "cooked",
    held_by_dwarf_id: null,
    position_x: x,
    position_y: y,
    position_z: z,
  });
}

describe("autoCookPhase", () => {
  it("does not create a task when food stock meets threshold", async () => {
    const items = Array.from({ length: MIN_COOK_STOCK }, () => rawFoodAt(5, 5, 0));
    const kitchen = makeKitchen();
    const ctx = makeContext({ items, structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a task when food count exceeds threshold", async () => {
    const items = Array.from({ length: MIN_COOK_STOCK + 5 }, () => rawFoodAt(5, 5, 0));
    const kitchen = makeKitchen();
    const ctx = makeContext({ items, structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("creates a cook task targeting the kitchen when food count is below threshold and raw food exists near kitchen", async () => {
    const kitchen = makeKitchen();
    const items = [rawFoodAt(5, 5, 0)];
    const ctx = makeContext({ items, structures: [kitchen] });

    await autoCookPhase(ctx);

    const cookTasks = ctx.state.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks).toHaveLength(1);
    expect(cookTasks[0].target_x).toBe(5);
    expect(cookTasks[0].target_y).toBe(5);
    expect(cookTasks[0].target_z).toBe(0);
    expect(cookTasks[0].target_item_id).toBe(kitchen.id);
  });

  it("does not create a task when no kitchen exists", async () => {
    const items = [rawFoodAt(5, 5, 0)];
    const ctx = makeContext({ items, structures: [] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a task when food is beyond workshop ingredient radius", async () => {
    // Kitchen at (5,5), food at (0,0) → Manhattan distance = 10 > radius 5
    const kitchen = makeKitchen();
    const items = [rawFoodAt(0, 0, 0)];
    const ctx = makeContext({ items, structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a duplicate task when a pending cook task exists", async () => {
    const kitchen = makeKitchen();
    const items = [rawFoodAt(5, 5, 0)];
    const existingTask = makeTask("cook", { status: "pending" });
    const ctx = makeContext({ items, tasks: [existingTask], structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(1);
  });

  it("does not create a duplicate task when an in-progress cook task exists", async () => {
    const kitchen = makeKitchen();
    const items = [rawFoodAt(5, 5, 0)];
    const existingTask = makeTask("cook", { status: "in_progress" });
    const ctx = makeContext({ items, tasks: [existingTask], structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(1);
  });

  it("does not create a task when no raw food is available near kitchen (only cooked meals)", async () => {
    const kitchen = makeKitchen();
    const items = [cookedFoodAt(5, 5, 0)];
    const ctx = makeContext({ items, structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a task when no food is on the ground at all", async () => {
    const kitchen = makeKitchen();
    const ctx = makeContext({ structures: [kitchen] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("creates a new task after a completed cook task (completed tasks are ignored)", async () => {
    const kitchen = makeKitchen();
    const items = [rawFoodAt(5, 5, 0)];
    const completedTask = makeTask("cook", { status: "completed" });
    const ctx = makeContext({ items, tasks: [completedTask], structures: [kitchen] });

    await autoCookPhase(ctx);

    const cookTasks = ctx.state.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks).toHaveLength(2); // existing completed + new pending
    expect(cookTasks.some(t => t.status === "pending")).toBe(true);
  });
});
