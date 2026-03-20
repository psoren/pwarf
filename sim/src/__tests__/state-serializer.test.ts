import { describe, it, expect } from "vitest";
import { serializeState } from "../state-serializer.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

describe("serializeState", () => {
  it("reports correct alive/dead counts", () => {
    const dwarves = [
      makeDwarf({ status: "alive" }),
      makeDwarf({ status: "alive" }),
      makeDwarf({ status: "dead", cause_of_death: "starvation", died_year: 1 }),
    ];
    const ctx = makeContext({ dwarves });
    const snap = serializeState(ctx);

    expect(snap.summary.population.alive).toBe(2);
    expect(snap.summary.population.dead).toBe(1);
    expect(snap.summary.deaths).toHaveLength(1);
    expect(snap.summary.deaths[0].cause).toBe("starvation");
  });

  it("labels critical food need correctly", () => {
    const dwarf = makeDwarf({ need_food: 5, status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.dwarves[0].needs.food).toMatch(/^critical/);
  });

  it("labels good food need correctly", () => {
    const dwarf = makeDwarf({ need_food: 90, status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.dwarves[0].needs.food).toMatch(/^good/);
  });

  it("generates hungry alert when dwarves are critically hungry", () => {
    const dwarves = [
      makeDwarf({ need_food: 8, status: "alive" }),
      makeDwarf({ need_food: 3, status: "alive" }),
    ];
    const ctx = makeContext({ dwarves });
    const snap = serializeState(ctx);

    expect(snap.summary.alerts.some(a => a.includes("critically hungry"))).toBe(true);
  });

  it("generates tantrum alert when dwarves are in tantrum", () => {
    const dwarf = makeDwarf({ is_in_tantrum: true, status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.summary.alerts.some(a => a.includes("tantrum"))).toBe(true);
  });

  it("generates no alerts for healthy dwarves", () => {
    const dwarf = makeDwarf({ need_food: 90, need_drink: 90, stress_level: 10 });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.summary.alerts).toHaveLength(0);
  });

  it("reports tick, year, day from context", () => {
    const ctx = makeContext({});
    ctx.step = 42;
    ctx.year = 3;
    ctx.day = 7;
    const snap = serializeState(ctx);

    expect(snap.summary.tick).toBe(42);
    expect(snap.summary.year).toBe(3);
    expect(snap.summary.day).toBe(7);
  });

  it("marks dead dwarves with dead activity", () => {
    const dwarf = makeDwarf({ status: "dead" });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.dwarves[0].activity).toBe("dead");
  });

  it("reports severe stress correctly", () => {
    const dwarf = makeDwarf({ stress_level: 85, status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });
    const snap = serializeState(ctx);

    expect(snap.dwarves[0].stress).toMatch(/^severe/);
    expect(snap.summary.alerts.some(a => a.includes("high stress"))).toBe(true);
  });

  it("includes tasks_completed in summary", () => {
    const ctx = makeContext({});
    const snap = serializeState(ctx, 17);

    expect(snap.summary.tasks_completed).toBe(17);
  });
});
