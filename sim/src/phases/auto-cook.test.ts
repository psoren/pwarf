import { describe, it, expect } from "vitest";
import { autoCookPhase } from "./auto-cook.js";
import { makeItem, makeTask, makeStructure, makeContext } from "../__tests__/test-helpers.js";
import { MIN_COOK_STOCK } from "@pwarf/shared";

function makeKitchen(x = 3, y = 4, z = 0) {
  return makeStructure({ type: 'kitchen', completion_pct: 100, position_x: x, position_y: y, position_z: z });
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
    const ctx = makeContext({ items });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a task when food count exceeds threshold", async () => {
    const items = Array.from({ length: MIN_COOK_STOCK + 5 }, () => rawFoodAt(5, 5, 0));
    const ctx = makeContext({ items });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("creates a cook task when food count is below threshold and raw food exists", async () => {
    const items = [rawFoodAt(3, 4, 0)];
    const ctx = makeContext({ items, structures: [makeKitchen()] });

    await autoCookPhase(ctx);

    const cookTasks = ctx.state.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks).toHaveLength(1);
    // Task targets the kitchen position
    expect(cookTasks[0].target_x).toBe(3);
    expect(cookTasks[0].target_y).toBe(4);
  });

  it("does not create a duplicate task when a pending cook task exists", async () => {
    const items = [rawFoodAt(3, 4, 0)];
    const existingTask = makeTask("cook", { status: "pending" });
    const ctx = makeContext({ items, tasks: [existingTask] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(1);
  });

  it("does not create a duplicate task when an in-progress cook task exists", async () => {
    const items = [rawFoodAt(3, 4, 0)];
    const existingTask = makeTask("cook", { status: "in_progress" });
    const ctx = makeContext({ items, tasks: [existingTask] });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(1);
  });

  it("does not create a task when no raw food is available (only cooked meals)", async () => {
    const items = [cookedFoodAt(3, 4, 0)];
    const ctx = makeContext({ items });

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("does not create a task when no food is on the ground at all", async () => {
    const ctx = makeContext({});

    await autoCookPhase(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "cook")).toHaveLength(0);
  });

  it("creates a new task after a completed cook task (completed tasks are ignored)", async () => {
    const items = [rawFoodAt(3, 4, 0)];
    const completedTask = makeTask("cook", { status: "completed" });
    const ctx = makeContext({ items, tasks: [completedTask], structures: [makeKitchen()] });

    await autoCookPhase(ctx);

    const cookTasks = ctx.state.tasks.filter(t => t.task_type === "cook");
    expect(cookTasks).toHaveLength(2); // existing completed + new pending
    expect(cookTasks.some(t => t.status === "pending")).toBe(true);
  });
});
