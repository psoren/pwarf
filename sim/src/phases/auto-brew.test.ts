import { describe, it, expect } from "vitest";
import { autoBrew } from "./auto-brew.js";
import { makeItem, makeContext } from "../__tests__/test-helpers.js";
import { MIN_DRINK_STOCK } from "@pwarf/shared";

describe("autoBrew", () => {
  it("does not create a brew task when drink count is at threshold", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makeItem({ category: "raw_material", position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ items: [...drinks, plant] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when drink count exceeds threshold", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK + 5 }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makeItem({ category: "raw_material", position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ items: [...drinks, plant] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("creates a brew task when drink count is below threshold and plant exists", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK - 1 }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makeItem({ category: "raw_material", position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ items: [...drinks, plant] });

    await autoBrew(ctx);

    const brewTasks = ctx.state.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks).toHaveLength(1);
    expect(brewTasks[0].target_x).toBe(3);
    expect(brewTasks[0].target_y).toBe(3);
    expect(brewTasks[0].target_z).toBe(0);
    expect(brewTasks[0].status).toBe("pending");
  });

  it("does not create a brew task when no plant items exist", async () => {
    const ctx = makeContext({ items: [] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when plant is held by a dwarf", async () => {
    const plant = makeItem({
      category: "raw_material",
      held_by_dwarf_id: "some-dwarf-id",
      position_x: 3,
      position_y: 3,
      position_z: 0,
    });
    const ctx = makeContext({ items: [plant] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a duplicate brew task when one already pending", async () => {
    const plant = makeItem({ category: "raw_material", position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ items: [plant] });

    // First call — creates a task
    await autoBrew(ctx);
    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(1);

    // Second call — should not create another
    await autoBrew(ctx);
    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(1);
  });

  it("creates a new brew task after the previous one completes", async () => {
    const plant = makeItem({ category: "raw_material", position_x: 3, position_y: 3, position_z: 0 });
    const ctx = makeContext({ items: [plant] });

    await autoBrew(ctx);
    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(1);

    // Mark the task as completed
    ctx.state.tasks.find(t => t.task_type === "brew")!.status = "completed";

    // Should create a new one
    await autoBrew(ctx);
    const brewTasks = ctx.state.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks.filter(t => t.status === "pending")).toHaveLength(1);
  });
});
