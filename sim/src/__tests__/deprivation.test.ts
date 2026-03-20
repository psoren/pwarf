import { describe, it, expect } from "vitest";
import { STARVATION_TICKS, DEHYDRATION_TICKS } from "@pwarf/shared";
import { handleDeprivationDeaths, killDwarf } from "../phases/deprivation.js";
import { createTask } from "../task-helpers.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

describe("handleDeprivationDeaths", () => {
  it("increments zero-food tick counter when food is 0", () => {
    const dwarf = makeDwarf({ need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.get(dwarf.id)).toBe(1);
  });

  it("resets zero-food counter when food is above 0", () => {
    const dwarf = makeDwarf({ need_food: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroFoodTicks.set(dwarf.id, 100);

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.has(dwarf.id)).toBe(false);
  });

  it("kills dwarf after STARVATION_TICKS at zero food", () => {
    const dwarf = makeDwarf({ need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroFoodTicks.set(dwarf.id, STARVATION_TICKS - 1);

    handleDeprivationDeaths(ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("starvation");
  });

  it("kills dwarf after DEHYDRATION_TICKS at zero drink", () => {
    const dwarf = makeDwarf({ need_drink: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.zeroDrinkTicks.set(dwarf.id, DEHYDRATION_TICKS - 1);

    handleDeprivationDeaths(ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("dehydration");
  });

  it("does not affect dead dwarves", () => {
    const dwarf = makeDwarf({ status: "dead", need_food: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    handleDeprivationDeaths(ctx);

    expect(ctx.state.zeroFoodTicks.has(dwarf.id)).toBe(false);
  });
});

describe("killDwarf", () => {
  it("sets dwarf to dead with cause", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    expect(dwarf.status).toBe("dead");
    expect(dwarf.cause_of_death).toBe("starvation");
    expect(dwarf.died_year).toBe(1);
    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
  });

  it("fails the dwarf's current task", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });
    const task = createTask(ctx, {
      task_type: "haul",
      target_x: 5,
      target_y: 5,
      target_z: 0,
    });
    task.status = "in_progress";
    task.assigned_dwarf_id = dwarf.id;
    dwarf.current_task_id = task.id;

    killDwarf(dwarf, "starvation", ctx);

    expect(task.status).toBe("failed");
    expect(task.assigned_dwarf_id).toBeNull();
    expect(dwarf.current_task_id).toBeNull();
  });

  it("fires fortress_fallen event when last dwarf dies", () => {
    const dwarf = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    const fallen = ctx.state.pendingEvents.filter(e => e.category === "fortress_fallen");
    expect(fallen).toHaveLength(1);
    expect(fallen[0]!.description).toContain("fortress has fallen");
  });

  it("does not fire fortress_fallen when other dwarves survive", () => {
    const dwarf1 = makeDwarf();
    const dwarf2 = makeDwarf();
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2] });

    killDwarf(dwarf1, "starvation", ctx);

    const fallen = ctx.state.pendingEvents.filter(e => e.category === "fortress_fallen");
    expect(fallen).toHaveLength(0);
  });
});
