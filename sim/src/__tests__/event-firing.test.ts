import { describe, it, expect } from "vitest";
import { eventFiring } from "../phases/event-firing.js";
import { makeDwarf, makeContext } from "./test-helpers.js";

describe("eventFiring", () => {
  it("fires starving warning when food crosses below 10", async () => {
    // need_food must be in the range [9.8, 10) to trigger
    const dwarf = makeDwarf({ need_food: 9.9 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await eventFiring(ctx);

    const warnings = ctx.state.pendingEvents.filter(
      e => e.description.includes("starving"),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.dwarf_id).toBe(dwarf.id);
  });

  it("fires dehydrated warning when drink crosses below 10", async () => {
    const dwarf = makeDwarf({ need_drink: 9.9 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await eventFiring(ctx);

    const warnings = ctx.state.pendingEvents.filter(
      e => e.description.includes("dehydrated"),
    );
    expect(warnings).toHaveLength(1);
  });

  it("does not fire warning when food is well above 10", async () => {
    const dwarf = makeDwarf({ need_food: 50 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await eventFiring(ctx);

    expect(ctx.state.pendingEvents).toHaveLength(0);
  });

  it("does not fire warning when food is far below threshold (already past)", async () => {
    const dwarf = makeDwarf({ need_food: 5 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await eventFiring(ctx);

    // 5 < 9.8 so it should not fire (already past the crossing window)
    expect(ctx.state.pendingEvents).toHaveLength(0);
  });

  it("does not fire warnings for dead dwarves", async () => {
    const dwarf = makeDwarf({ status: "dead", need_food: 9.9 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await eventFiring(ctx);

    expect(ctx.state.pendingEvents).toHaveLength(0);
  });
});
