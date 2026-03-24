import { describe, it, expect } from "vitest";
import { expeditionTick } from "./expedition-tick.js";
import { makeContext, makeDwarf, makeExpedition, makeRuin, makeSkill } from "../__tests__/test-helpers.js";

describe("expeditionTick", () => {
  it("decrements travel_ticks_remaining each tick", () => {
    const dwarf = makeDwarf({ id: "d1", status: "missing" });
    const ruin = makeRuin({ id: "r1" });
    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      travel_ticks_remaining: 50,
      status: "traveling",
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.expeditions = [expedition];
    ctx.state.ruins = [ruin];

    expeditionTick(ctx);

    expect(expedition.travel_ticks_remaining).toBe(49);
    expect(ctx.state.dirtyExpeditionIds.has("e1")).toBe(true);
  });

  it("resolves expedition when travel_ticks_remaining reaches 0", () => {
    const dwarf = makeDwarf({ id: "d1", status: "missing", name: "Urist" });
    const ruin = makeRuin({
      id: "r1",
      danger_level: 5, // very low danger
      remaining_wealth: 3000,
    });
    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      travel_ticks_remaining: 1, // will reach 0 this tick
      status: "traveling",
      destination_tile_x: 5,
      destination_tile_y: 5,
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.expeditions = [expedition];
    ctx.state.ruins = [ruin];

    expeditionTick(ctx);

    expect(expedition.status).toBe("retreating");
    expect(expedition.return_ticks_remaining).toBeGreaterThan(0);
    expect(expedition.expedition_log).toBeTruthy();
    // Ruin wealth should be reduced
    expect(ruin.remaining_wealth).toBeLessThan(3000);
  });

  it("returns dwarves to fortress when return trip completes", () => {
    const dwarf = makeDwarf({ id: "d1", status: "missing", name: "Urist" });
    const ruin = makeRuin({ id: "r1" });
    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      return_ticks_remaining: 1, // will reach 0 this tick
      status: "retreating" as const,
      expedition_log: "Test log",
      items_looted: ["standard iron gem"],
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.expeditions = [expedition];
    ctx.state.ruins = [ruin];
    // Set up pending loot
    ctx.state._pendingExpeditionLoot.set("e1", [
      { category: "gem", material: "iron", quality: "standard" },
    ]);

    expeditionTick(ctx);

    expect(expedition.status).toBe("complete");
    expect(dwarf.status).toBe("alive");
    expect(dwarf.position_x).toBe(256);
    expect(dwarf.position_y).toBe(256);
    expect(dwarf.position_z).toBe(0);
    // Loot item should have been created
    expect(ctx.state.items.length).toBe(1);
    expect(ctx.state.items[0]!.category).toBe("gem");
    // World event should be fired
    expect(ctx.state.pendingEvents.length).toBe(1);
    expect(ctx.state.pendingEvents[0]!.category).toBe("discovery");
  });

  it("dead dwarves are not returned from expedition", () => {
    const d1 = makeDwarf({ id: "d1", status: "dead", name: "Dead" });
    const d2 = makeDwarf({ id: "d2", status: "missing", name: "Alive" });
    const ruin = makeRuin({ id: "r1" });
    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1", "d2"],
      return_ticks_remaining: 1,
      status: "retreating" as const,
      dwarves_lost: 1,
    });

    const ctx = makeContext({ dwarves: [d1, d2] });
    ctx.state.expeditions = [expedition];
    ctx.state.ruins = [ruin];

    expeditionTick(ctx);

    expect(d1.status).toBe("dead"); // stays dead
    expect(d2.status).toBe("alive"); // returned
    expect(d2.position_x).toBe(256);
  });

  it("no loot created when all dwarves died", () => {
    const dwarf = makeDwarf({ id: "d1", status: "dead" });
    const ruin = makeRuin({ id: "r1" });
    const expedition = makeExpedition({
      id: "e1",
      ruin_id: "r1",
      dwarf_ids: ["d1"],
      return_ticks_remaining: 1,
      status: "retreating" as const,
    });

    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.expeditions = [expedition];
    ctx.state.ruins = [ruin];
    ctx.state._pendingExpeditionLoot.set("e1", [
      { category: "gem", material: "gold", quality: "fine" },
    ]);

    expeditionTick(ctx);

    // No loot should be created because no survivors
    expect(ctx.state.items.length).toBe(0);
  });
});
