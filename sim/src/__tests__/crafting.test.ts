import { describe, it, expect } from "vitest";
import { createTestContext } from "../sim-context.js";
import { makeDwarf, makeTask, makeItem } from "./test-helpers.js";
import {
  completeBrew,
  completeCook,
  completeSmith,
  restoreMoraleOnTaskComplete,
  SMOOTHABLE_TILES,
} from "../phases/task-completion.js";

// ---------------------------------------------------------------------------
// completeBrew
// ---------------------------------------------------------------------------

describe("completeBrew", () => {
  it("consumes a plant item at the target tile and creates a drink", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 5, position_y: 5 });
    ctx.state.dwarves = [dwarf];

    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      position_x: 5,
      position_y: 5,
      position_z: 0,
    });
    ctx.state.items = [plant];

    const task = makeTask("brew", {
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });

    completeBrew(dwarf, task, ctx);

    // Plant item should be consumed
    expect(ctx.state.items.find(i => i.id === plant.id)).toBeUndefined();

    // A drink item should be created at the target location
    const ale = ctx.state.items.find(i => i.category === "drink");
    expect(ale).toBeDefined();
    expect(ale?.position_x).toBe(5);
    expect(ale?.position_y).toBe(5);
  });

  it("creates a drink even if no plant ingredient is available", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf();
    const task = makeTask("brew", { target_x: 0, target_y: 0, target_z: 0 });

    completeBrew(dwarf, task, ctx);

    const ale = ctx.state.items.find(i => i.category === "drink");
    expect(ale).toBeDefined();
  });

  it("consumes a plant held by the dwarf if none at tile", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ id: "dwarf-1" });
    ctx.state.dwarves = [dwarf];

    const plant = makeItem({
      category: "raw_material",
      material: "plant",
      held_by_dwarf_id: "dwarf-1",
    });
    ctx.state.items = [plant];

    const task = makeTask("brew", { target_x: 1, target_y: 1, target_z: 0 });
    completeBrew(dwarf, task, ctx);

    expect(ctx.state.items.find(i => i.id === plant.id)).toBeUndefined();
    expect(ctx.state.items.find(i => i.category === "drink")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// completeCook
// ---------------------------------------------------------------------------

describe("completeCook", () => {
  it("consumes a food item and creates a prepared meal", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 3, position_y: 3 });
    ctx.state.dwarves = [dwarf];

    const food = makeItem({
      category: "food",
      position_x: 3,
      position_y: 3,
      position_z: 0,
    });
    ctx.state.items = [food];

    const task = makeTask("cook", { target_x: 3, target_y: 3, target_z: 0 });
    completeCook(dwarf, task, ctx);

    expect(ctx.state.items.find(i => i.id === food.id)).toBeUndefined();
    const meal = ctx.state.items.find(i => i.name === "Prepared meal");
    expect(meal).toBeDefined();
    expect(meal?.quality).toBe("fine");
    expect(meal?.value).toBeGreaterThan(2);
  });

  it("creates a meal even without an ingredient", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf();
    const task = makeTask("cook", { target_x: 0, target_y: 0, target_z: 0 });
    completeCook(dwarf, task, ctx);
    expect(ctx.state.items.find(i => i.name === "Prepared meal")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// completeSmith
// ---------------------------------------------------------------------------

describe("completeSmith", () => {
  it("consumes a raw_material and creates a tool", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf({ position_x: 2, position_y: 2 });

    const ore = makeItem({
      category: "raw_material",
      material: "iron",
      position_x: 2,
      position_y: 2,
      position_z: 0,
    });
    ctx.state.items = [ore];

    const task = makeTask("smith", { target_x: 2, target_y: 2, target_z: 0 });
    completeSmith(dwarf, task, ctx);

    expect(ctx.state.items.find(i => i.id === ore.id)).toBeUndefined();
    const tool = ctx.state.items.find(i => i.category === "tool");
    expect(tool).toBeDefined();
    expect(tool?.material).toBe("iron");
  });

  it("creates a tool with stone material if no ore available", () => {
    const ctx = createTestContext();
    const dwarf = makeDwarf();
    const task = makeTask("smith", { target_x: 0, target_y: 0, target_z: 0 });
    completeSmith(dwarf, task, ctx);
    const tool = ctx.state.items.find(i => i.category === "tool");
    expect(tool).toBeDefined();
    expect(tool?.material).toBe("stone");
  });
});

// ---------------------------------------------------------------------------
// restoreMoraleOnTaskComplete — crafting tasks are SKILLED_TASKS
// ---------------------------------------------------------------------------

describe("restoreMoraleOnTaskComplete for crafting tasks", () => {
  it.each(["smooth", "engrave", "brew", "cook", "smith"] as const)(
    "%s restores morale like a skilled task",
    (taskType) => {
      const dwarf = makeDwarf({ need_social: 50, trait_conscientiousness: null });
      restoreMoraleOnTaskComplete(dwarf, taskType);
      expect(dwarf.need_social).toBeGreaterThan(50);
    },
  );
});

// ---------------------------------------------------------------------------
// SMOOTHABLE_TILES constant
// ---------------------------------------------------------------------------

describe("SMOOTHABLE_TILES", () => {
  it("contains rock and stone", () => {
    expect(SMOOTHABLE_TILES.has("rock")).toBe(true);
    expect(SMOOTHABLE_TILES.has("stone")).toBe(true);
  });

  it("does not contain open_air", () => {
    expect(SMOOTHABLE_TILES.has("open_air")).toBe(false);
  });
});
