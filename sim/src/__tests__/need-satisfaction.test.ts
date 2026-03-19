import { describe, it, expect } from "vitest";
import type { FortressTile, FortressDeriver, FortressTileType } from "@pwarf/shared";
import { makeDwarf, makeItem, makeContext } from "./test-helpers.js";
import { needSatisfaction } from "../phases/need-satisfaction.js";
import { findNearestTileOfType } from "../task-helpers.js";

describe("tile-based need satisfaction", () => {
  it("creates drink task targeting a well when thirsty", async () => {
    const dwarf = makeDwarf({ need_drink: 10, position_x: 128, position_y: 128, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Place a well tile in overrides
    const wellKey = "130,128,0";
    ctx.state.fortressTileOverrides.set(wellKey, {
      id: "well-1",
      civilization_id: "civ-1",
      x: 130, y: 128, z: 0,
      tile_type: "well",
      material: "stone",
      is_revealed: true,
      is_mined: false,
      created_at: new Date().toISOString(),
    } as FortressTile);

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_x).toBe(130);
    expect(drinkTasks[0]!.target_y).toBe(128);
    expect(drinkTasks[0]!.target_item_id).toBeNull();
  });

  it("creates eat task targeting a mushroom garden when hungry", async () => {
    const dwarf = makeDwarf({ need_food: 10, position_x: 128, position_y: 128, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    // Place a mushroom garden tile
    const gardenKey = "126,128,0";
    ctx.state.fortressTileOverrides.set(gardenKey, {
      id: "garden-1",
      civilization_id: "civ-1",
      x: 126, y: 128, z: 0,
      tile_type: "mushroom_garden",
      material: "plant",
      is_revealed: true,
      is_mined: false,
      created_at: new Date().toISOString(),
    } as FortressTile);

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.target_x).toBe(126);
    expect(eatTasks[0]!.target_y).toBe(128);
    expect(eatTasks[0]!.target_item_id).toBeNull();
  });

  it("falls back to food item when no mushroom garden exists", async () => {
    const dwarf = makeDwarf({ need_food: 10, position_x: 128, position_y: 128, position_z: 0 });
    const food = makeItem({ category: "food" });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.target_item_id).toBe(food.id);
  });

  it("does not create drink task when no well and no drink items exist", async () => {
    const dwarf = makeDwarf({ need_drink: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(0);
  });
});

describe("findNearestTileOfType", () => {
  it("finds a tile in overrides", () => {
    const overrides = new Map<string, FortressTile>();
    overrides.set("5,5,0", {
      id: "t1", civilization_id: "c1", x: 5, y: 5, z: 0,
      tile_type: "well", material: null, is_revealed: true, is_mined: false,
      created_at: "",
    } as FortressTile);

    const result = findNearestTileOfType("well", 3, 5, 0, overrides, null);
    expect(result).toEqual({ x: 5, y: 5, z: 0 });
  });

  it("finds a tile via deriver", () => {
    const deriver: FortressDeriver = {
      deriveTile(x: number, y: number, _z: number) {
        if (x === 10 && y === 10) return { tileType: "mushroom_garden" as FortressTileType, material: null };
        return { tileType: "open_air" as FortressTileType, material: null };
      },
    };

    const result = findNearestTileOfType("mushroom_garden", 10, 10, 0, new Map(), deriver);
    expect(result).toEqual({ x: 10, y: 10, z: 0 });
  });

  it("returns null when tile type not found", () => {
    const result = findNearestTileOfType("well", 5, 5, 0, new Map(), null, 5);
    expect(result).toBeNull();
  });
});
