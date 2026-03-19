import { describe, it, expect } from "vitest";
import { NEED_INTERRUPT_FOOD, NEED_INTERRUPT_DRINK } from "@pwarf/shared";
import { makeDwarf, makeContext } from "./test-helpers.js";
import { needSatisfaction } from "../phases/need-satisfaction.js";

describe("infinite source need satisfaction", () => {
  it("creates eat task with no target item when hungry", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
    expect(eatTasks[0]!.target_item_id).toBeNull();
    expect(eatTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("creates drink task with no target item when thirsty", async () => {
    const dwarf = makeDwarf({ need_drink: NEED_INTERRUPT_DRINK - 1 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await needSatisfaction(ctx);

    const drinkTasks = ctx.state.tasks.filter(t => t.task_type === "drink");
    expect(drinkTasks).toHaveLength(1);
    expect(drinkTasks[0]!.target_item_id).toBeNull();
    expect(drinkTasks[0]!.assigned_dwarf_id).toBe(dwarf.id);
  });

  it("does not create eat task when food need is above threshold", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD + 10 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(0);
  });

  it("always creates eat task regardless of item availability", async () => {
    const dwarf = makeDwarf({ need_food: NEED_INTERRUPT_FOOD - 1 });
    const ctx = makeContext({ dwarves: [dwarf], items: [] });

    await needSatisfaction(ctx);

    const eatTasks = ctx.state.tasks.filter(t => t.task_type === "eat");
    expect(eatTasks).toHaveLength(1);
  });
});
