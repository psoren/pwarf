import { describe, it, expect } from "vitest";
import { autoBrew } from "./auto-brew.js";
import { makeItem, makeContext, makeStructure } from "../__tests__/test-helpers.js";
import { MIN_DRINK_STOCK } from "@pwarf/shared";

/** Helper: make an unoccupied still at (5,5,0) */
function makeStill() {
  return makeStructure({
    type: "still",
    civilization_id: "civ-1",
    completion_pct: 100,
    occupied_by_dwarf_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
  });
}

/** Helper: make a plant item at the still position */
function makePlant(x = 5, y = 5) {
  return makeItem({
    category: "raw_material",
    material: "plant",
    position_x: x,
    position_y: y,
    position_z: 0,
    held_by_dwarf_id: null,
  });
}

describe("autoBrew", () => {
  it("does not create a brew task when drink count is at threshold", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makePlant();
    const still = makeStill();
    const ctx = makeContext({ items: [...drinks, plant], structures: [still] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when drink count exceeds threshold", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK + 5 }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makePlant();
    const still = makeStill();
    const ctx = makeContext({ items: [...drinks, plant], structures: [still] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("creates a brew task targeting the still when drink count is below threshold and plant exists near still", async () => {
    const drinks = Array.from({ length: MIN_DRINK_STOCK - 1 }, () =>
      makeItem({ category: "drink", position_x: 5, position_y: 5, position_z: 0 }),
    );
    const plant = makePlant();
    const still = makeStill();
    const ctx = makeContext({ items: [...drinks, plant], structures: [still] });

    await autoBrew(ctx);

    const brewTasks = ctx.state.tasks.filter(t => t.task_type === "brew");
    expect(brewTasks).toHaveLength(1);
    // Task should target the still position
    expect(brewTasks[0].target_x).toBe(5);
    expect(brewTasks[0].target_y).toBe(5);
    expect(brewTasks[0].target_z).toBe(0);
    expect(brewTasks[0].target_item_id).toBe(still.id);
    expect(brewTasks[0].status).toBe("pending");
  });

  it("does not create a brew task when no plant items exist", async () => {
    const still = makeStill();
    const ctx = makeContext({ items: [], structures: [still] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when no still exists", async () => {
    const plant = makePlant();
    const ctx = makeContext({ items: [plant], structures: [] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when still is occupied", async () => {
    const occupiedStill = makeStructure({
      type: "still",
      civilization_id: "civ-1",
      completion_pct: 100,
      occupied_by_dwarf_id: "some-dwarf",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const plant = makePlant();
    const ctx = makeContext({ items: [plant], structures: [occupiedStill] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when plant is beyond workshop ingredient radius", async () => {
    // Still at (5,5), plant at (0,0) → Manhattan distance = 10 > radius 5
    const plant = makePlant(0, 0);
    const still = makeStill();
    const ctx = makeContext({ items: [plant], structures: [still] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a brew task when plant is held by a dwarf", async () => {
    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      held_by_dwarf_id: "some-dwarf-id",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    const still = makeStill();
    const ctx = makeContext({ items: [plant], structures: [still] });

    await autoBrew(ctx);

    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(0);
  });

  it("does not create a duplicate brew task when one already pending", async () => {
    const plant = makePlant();
    const still = makeStill();
    const ctx = makeContext({ items: [plant], structures: [still] });

    // First call — creates a task
    await autoBrew(ctx);
    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(1);

    // Second call — should not create another
    await autoBrew(ctx);
    expect(ctx.state.tasks.filter(t => t.task_type === "brew")).toHaveLength(1);
  });

  it("creates a new brew task after the previous one completes", async () => {
    const plant = makePlant();
    const still = makeStill();
    const ctx = makeContext({ items: [plant], structures: [still] });

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
