import { describe, it, expect } from "vitest";
import { eventFiring } from "./event-firing.js";
import { makeDwarf, makeContext } from "../__tests__/test-helpers.js";

describe("eventFiring", () => {
  describe("critical food warning", () => {
    it("fires a discovery event when food drops below threshold", async () => {
      const dwarf = makeDwarf({ need_food: 5 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(1);
      expect(ctx.state.pendingEvents[0].category).toBe("discovery");
      expect(ctx.state.pendingEvents[0].description).toContain("starving");
      expect(ctx.state.pendingEvents[0].dwarf_id).toBe(dwarf.id);
    });

    it("fires only once per crossing (not every tick)", async () => {
      const dwarf = makeDwarf({ need_food: 5 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);
      await eventFiring(ctx);
      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(1);
    });

    it("does not fire when food is above threshold", async () => {
      const dwarf = makeDwarf({ need_food: 15 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(0);
    });

    it("re-fires after need recovers above reset level", async () => {
      const dwarf = makeDwarf({ need_food: 5 });
      const ctx = makeContext({ dwarves: [dwarf] });

      // First crossing
      await eventFiring(ctx);
      expect(ctx.state.pendingEvents).toHaveLength(1);

      // Recover above reset threshold
      dwarf.need_food = 25;
      await eventFiring(ctx); // no event (recovering)

      // Drop below threshold again
      dwarf.need_food = 5;
      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(2);
    });

    it("does not re-fire until fully recovered above reset threshold", async () => {
      const dwarf = makeDwarf({ need_food: 5 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);
      expect(ctx.state.pendingEvents).toHaveLength(1);

      // Recover to just above threshold but below reset
      dwarf.need_food = 15;
      await eventFiring(ctx);

      // Drop below threshold again — should NOT re-fire yet
      dwarf.need_food = 5;
      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(1);
    });
  });

  describe("critical drink warning", () => {
    it("fires a discovery event when drink drops below threshold", async () => {
      const dwarf = makeDwarf({ need_drink: 3 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(1);
      expect(ctx.state.pendingEvents[0].category).toBe("discovery");
      expect(ctx.state.pendingEvents[0].description).toContain("dehydrated");
    });

    it("fires only once per crossing", async () => {
      const dwarf = makeDwarf({ need_drink: 3 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);
      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(1);
    });
  });

  describe("combined food and drink", () => {
    it("fires separate events for food and drink in the same tick", async () => {
      const dwarf = makeDwarf({ need_food: 5, need_drink: 3 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(2);
      const categories = ctx.state.pendingEvents.map(e => e.event_data?.need);
      expect(categories).toContain("food");
      expect(categories).toContain("drink");
    });
  });

  describe("dead dwarves", () => {
    it("does not fire events for dead dwarves", async () => {
      const dwarf = makeDwarf({ status: "dead", need_food: 0, need_drink: 0 });
      const ctx = makeContext({ dwarves: [dwarf] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(0);
    });
  });

  describe("multiple dwarves", () => {
    it("fires independent events per dwarf", async () => {
      const dwarfA = makeDwarf({ need_food: 5 });
      const dwarfB = makeDwarf({ need_food: 5 });
      const ctx = makeContext({ dwarves: [dwarfA, dwarfB] });

      await eventFiring(ctx);

      expect(ctx.state.pendingEvents).toHaveLength(2);
    });
  });
});
