import { describe, it, expect } from "vitest";
import { killDwarf } from "./deprivation.js";
import { makeDwarf, makeContext } from "../__tests__/test-helpers.js";

describe("killDwarf — civ fallen detection", () => {
  it("sets civFallen and fires fortress_fallen event when last dwarf dies", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "starvation", ctx);

    expect(ctx.state.civFallen).toBe(true);
    expect(ctx.state.civFallenCause).toBe("starvation");
    const event = ctx.state.pendingEvents.find(e => e.category === "fortress_fallen");
    expect(event).toBeDefined();
    expect(event?.description).toMatch(/last dwarf/i);
  });

  it("maps dehydration to 'starvation' cause of death", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "dehydration", ctx);

    expect(ctx.state.civFallenCause).toBe("starvation");
  });

  it("maps tantrum_spiral cause correctly", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "tantrum_spiral", ctx);

    expect(ctx.state.civFallenCause).toBe("tantrum_spiral");
  });

  it("maps plague cause correctly", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "plague", ctx);

    expect(ctx.state.civFallenCause).toBe("plague");
  });

  it("maps unknown causes to 'unknown'", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });

    killDwarf(dwarf, "cave_in", ctx);

    expect(ctx.state.civFallenCause).toBe("unknown");
  });

  it("does NOT set civFallen when alive dwarves remain", () => {
    const dying = makeDwarf({ status: "alive" });
    const survivor = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dying, survivor] });

    killDwarf(dying, "starvation", ctx);

    expect(ctx.state.civFallen).toBe(false);
    const event = ctx.state.pendingEvents.find(e => e.category === "fortress_fallen");
    expect(event).toBeUndefined();
  });

  it("does not fire fortress_fallen event if civFallen is already true", () => {
    const dwarf = makeDwarf({ status: "alive" });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.civFallen = true; // Already fallen (e.g. from a prior tick)

    killDwarf(dwarf, "starvation", ctx);

    const events = ctx.state.pendingEvents.filter(e => e.category === "fortress_fallen");
    expect(events).toHaveLength(0);
  });
});
