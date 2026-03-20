import { describe, it, expect } from "vitest";
import { runScenario } from "./run-scenario.js";
import { makeDwarf } from "./__tests__/test-helpers.js";
import {
  FOOD_DECAY_PER_TICK,
  DRINK_DECAY_PER_TICK,
  NEED_INTERRUPT_FOOD,
  STEPS_PER_YEAR,
} from "@pwarf/shared";

describe("runScenario", () => {
  it("returns correct tick and year counts", async () => {
    const dwarf = makeDwarf();
    const result = await runScenario({ dwarves: [dwarf], ticks: 10 });
    expect(result.ticks).toBe(10);
    expect(result.year).toBe(1);
  });

  it("advances year after STEPS_PER_YEAR ticks", async () => {
    const result = await runScenario({ dwarves: [makeDwarf()], ticks: STEPS_PER_YEAR });
    expect(result.year).toBe(2);
  });

  it("need_food decays each tick until eat task fires", async () => {
    // Start with high needs — food decays at FOOD_DECAY_PER_TICK per tick
    // It should drop until it hits NEED_INTERRUPT_FOOD, then eat tasks kick in
    const dwarf = makeDwarf({ need_food: 100, need_drink: 100, need_sleep: 100 });
    const ticks = Math.ceil((100 - NEED_INTERRUPT_FOOD) / FOOD_DECAY_PER_TICK) - 1;
    const result = await runScenario({ dwarves: [dwarf], ticks, seed: 1 });
    // After enough ticks, food should have decayed from 100
    expect(result.dwarves[0].need_food).toBeLessThan(100);
    expect(result.dwarves[0].need_food).toBeGreaterThanOrEqual(0);
  });

  it("dead dwarves are included in the result", async () => {
    // A dwarf already marked dead should remain dead through the run
    const dead = makeDwarf({ status: "dead", cause_of_death: "starvation" });
    const result = await runScenario({ dwarves: [dead], ticks: 5 });
    expect(result.dwarves).toHaveLength(1);
    expect(result.dwarves[0].status).toBe("dead");
  });

  it("runs deterministically with same seed", async () => {
    const dwarf = makeDwarf();
    const a = await runScenario({ dwarves: [dwarf], ticks: 100, seed: 42 });
    const b = await runScenario({ dwarves: [makeDwarf({ ...dwarf })], ticks: 100, seed: 42 });
    expect(a.dwarves[0].position_x).toBe(b.dwarves[0].position_x);
    expect(a.dwarves[0].position_y).toBe(b.dwarves[0].position_y);
    expect(a.dwarves[0].need_food).toBe(b.dwarves[0].need_food);
    expect(a.dwarves[0].stress_level).toBe(b.dwarves[0].stress_level);
  });

  it("does not mutate caller's input dwarves", async () => {
    const dwarf = makeDwarf({ need_food: 100 });
    const originalFood = dwarf.need_food;
    await runScenario({ dwarves: [dwarf], ticks: 50, seed: 1 });
    // Input object should be unchanged after the run
    expect(dwarf.need_food).toBe(originalFood);
  });

  it("two different seeds produce different positions after idle wandering", async () => {
    // Run enough ticks for wander tasks to complete and diverge
    const makeBase = () => makeDwarf({ position_x: 100, position_y: 100 });
    const a = await runScenario({ dwarves: [makeBase()], ticks: 200, seed: 1 });
    const b = await runScenario({ dwarves: [makeBase()], ticks: 200, seed: 99999 });
    const posA = `${a.dwarves[0].position_x},${a.dwarves[0].position_y}`;
    const posB = `${b.dwarves[0].position_x},${b.dwarves[0].position_y}`;
    expect(posA).not.toBe(posB);
  });
});
