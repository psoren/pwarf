import { describe, it, expect } from "vitest";
import { NEED_INTERRUPT_FOOD, NEED_INTERRUPT_DRINK, NEED_INTERRUPT_SLEEP } from "@pwarf/shared";
import { makeDwarf, makeContext, makeStructure, makeItem } from "./test-helpers.js";
import { needSatisfaction } from "../phases/need-satisfaction.js";

describe("food/water source need satisfaction", () => {
  it("creates eat task targeting the nearest food item when hungry", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1, position_x: 0, position_y: 0, position_z: 0 });
    const food = makeItem({ category: "food", position_x: 3, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.target_item_id).toBe(food.id);
    expect(eatTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("creates drink task targeting the nearest well when thirsty", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1, position_x: 0, position_y: 0, position_z: 0 });
    const well = makeStructure({ type: "well", position_x: 3, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [well] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_item_id).toBeNull(); // wells have no item id
    expect(drinkTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("does not create eat task when food need is above threshold", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD + 10 });
    const food = makeItem({ category: "food", position_x: 3, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [food] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(0);
  });

  it("does NOT create eat task when no food is available", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1 });
    const ctx = makeContext({ dwarves: [dwarf], items: [] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(0);
  });

  it("does NOT create drink task when no water source is available", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1 });
    const ctx = makeContext({ dwarves: [dwarf], items: [], structures: [] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(0);
  });

  it("creates drink task targeting a drink item when no well exists", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1, position_x: 0, position_y: 0, position_z: 0 });
    const beer = makeItem({ category: "drink", position_x: 2, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], items: [beer] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_item_id).toBe(beer.id);
  });
});

describe("bed-seeking sleep", () => {
  it("creates sleep task targeting bed when one is available", async () => {
    const dwarf = makeDwarf({ need_sleep: NEED_INTERRUPT_SLEEP - 1, position_x: 5, position_y: 5, position_z: 0 });
    const bed = makeStructure({ position_x: 8, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [bed] });

    await needSatisfaction(ctx);

    const sleepTasks = ctx.state.tasks.filter(t => t.task_type === "sleep");
    expect(sleepTasks).toHaveLength(1);
    expect(sleepTasks[0]!.target_x).toBe(8);
    expect(sleepTasks[0]!.target_y).toBe(5);
    expect(sleepTasks[0]!.target_item_id).toBe(bed.id);
    expect(bed.occupied_by_dwarf_id).toBe(dwarf.id);
  });

  it("falls back to floor sleep when no beds available", async () => {
    const dwarf = makeDwarf({ need_sleep: NEED_INTERRUPT_SLEEP - 1, position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await needSatisfaction(ctx);

    const sleepTasks = ctx.state.tasks.filter(t => t.task_type === "sleep");
    expect(sleepTasks).toHaveLength(1);
    expect(sleepTasks[0]!.target_x).toBe(5);
    expect(sleepTasks[0]!.target_y).toBe(5);
    expect(sleepTasks[0]!.target_item_id).toBeNull();
  });

  it("skips occupied beds and picks next nearest", async () => {
    const dwarf = makeDwarf({ need_sleep: NEED_INTERRUPT_SLEEP - 1, position_x: 0, position_y: 0, position_z: 0 });
    const occupiedBed = makeStructure({ position_x: 1, position_y: 0, position_z: 0, occupied_by_dwarf_id: "other-dwarf" });
    const freeBed = makeStructure({ position_x: 3, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [occupiedBed, freeBed] });

    await needSatisfaction(ctx);

    const sleepTasks = ctx.state.tasks.filter(t => t.task_type === "sleep");
    expect(sleepTasks).toHaveLength(1);
    expect(sleepTasks[0]!.target_item_id).toBe(freeBed.id);
  });
});
