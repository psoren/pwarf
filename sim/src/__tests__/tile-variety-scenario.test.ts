import { describe, it, expect } from "vitest";
import { NEED_INTERRUPT_DRINK } from "@pwarf/shared";
import {
  getMineProduct,
  FORAGE_FOOD_NAMES,
} from "../phases/task-completion.js";
import { getTileHardness } from "../phases/task-execution.js";
import { isWalkable } from "../pathfinding.js";
import { needSatisfaction } from "../phases/need-satisfaction.js";
import { makeDwarf, makeContext, makeTask, makeMapTile } from "./test-helpers.js";

// ---------------------------------------------------------------------------
// 1. Crystal mining: produces Crystal shard with correct material and value
// ---------------------------------------------------------------------------

describe("crystal tile", () => {
  it("getMineProduct returns Crystal shard for crystal tile", () => {
    const result = getMineProduct("crystal");
    expect(result.itemName).toBe("Crystal shard");
    expect(result.itemMaterial).toBe("crystal");
    expect(result.itemWeight).toBe(3);
    expect(result.itemValue).toBe(15);
  });

  it("crystal tile has gem-level hardness", () => {
    const hardness = getTileHardness("crystal");
    expect(hardness).toBeGreaterThan(1.0); // harder than stone
    expect(hardness).toBeLessThan(1.5);   // not as hard as cavern_wall
  });

  it("crystal is NOT walkable (mineable wall type)", () => {
    expect(isWalkable("crystal")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Fungal growth foraging: produces "Cave mushroom" food
// ---------------------------------------------------------------------------

describe("fungal_growth foraging", () => {
  it("forage task on fungal_growth tile produces Cave mushroom", async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: -1 });
    const task = makeTask("forage", {
      status: "in_progress",
      assigned_dwarf_id: dwarf.id,
      target_x: 5,
      target_y: 5,
      target_z: -1,
      work_progress: 999,
      work_required: 100,
    });
    dwarf.current_task_id = task.id;

    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    // Place a fungal_growth tile override at the target
    const fungalTile = makeMapTile(5, 5, -1, "fungal_growth");
    ctx.state.fortressTileOverrides.set("5,5,-1", fungalTile);

    // Directly call completeForage by completing the task manually
    const { completeTask } = await import("../phases/task-completion.js");
    completeTask(dwarf, task, ctx);

    const foods = ctx.state.items.filter(i => i.category === "food");
    expect(foods).toHaveLength(1);
    expect(foods[0]!.name).toBe("Cave mushroom");
  });

  it("forage task on normal tile produces FORAGE_FOOD_NAMES item", async () => {
    const dwarf = makeDwarf({ position_x: 3, position_y: 3, position_z: 0 });
    const task = makeTask("forage", {
      status: "in_progress",
      assigned_dwarf_id: dwarf.id,
      target_x: 3,
      target_y: 3,
      target_z: 0,
      work_progress: 999,
      work_required: 100,
    });
    dwarf.current_task_id = task.id;

    const ctx = makeContext({ dwarves: [dwarf], tasks: [task] });

    const bushTile = makeMapTile(3, 3, 0, "bush");
    ctx.state.fortressTileOverrides.set("3,3,0", bushTile);

    const { completeTask } = await import("../phases/task-completion.js");
    completeTask(dwarf, task, ctx);

    const foods = ctx.state.items.filter(i => i.category === "food");
    expect(foods).toHaveLength(1);
    expect(FORAGE_FOOD_NAMES as readonly string[]).toContain(foods[0]!.name);
  });
});

// ---------------------------------------------------------------------------
// 3. Spring tile as water source: dwarf can drink without a well
// ---------------------------------------------------------------------------

describe("spring tile as water source", () => {
  it("creates drink task targeting a spring tile when thirsty and no well exists", async () => {
    const dwarf = makeDwarf({
      need_drink: NEED_INTERRUPT_DRINK - 1,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [], structures: [] });

    // Place a spring tile override
    const springTile = makeMapTile(5, 0, 0, "spring");
    ctx.state.fortressTileOverrides.set("5,0,0", springTile);

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_x).toBe(5);
    expect(drinkTasks[0]!.target_y).toBe(0);
    expect(drinkTasks[0]!.target_z).toBe(0);
    expect(drinkTasks[0]!.target_item_id).toBeNull(); // spring is infinite, no item consumed
    expect(drinkTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("does NOT create drink task when thirsty with no spring and no well", async () => {
    const dwarf = makeDwarf({
      need_drink: NEED_INTERRUPT_DRINK - 1,
      position_x: 0,
      position_y: 0,
      position_z: 0,
    });
    const ctx = makeContext({ dwarves: [dwarf], items: [], structures: [] });
    // No spring tile, no well → should not create drink task

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Pathfinding through new tiles
// ---------------------------------------------------------------------------

describe("pathfinding with new tile types", () => {
  it("flower, spring, glowing_moss, fungal_growth are walkable", () => {
    expect(isWalkable("flower")).toBe(true);
    expect(isWalkable("spring")).toBe(true);
    expect(isWalkable("glowing_moss")).toBe(true);
    expect(isWalkable("fungal_growth")).toBe(true);
  });

  it("crystal is NOT walkable (like rock wall)", () => {
    expect(isWalkable("crystal")).toBe(false);
  });
});
