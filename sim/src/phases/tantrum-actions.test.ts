import { describe, it, expect } from "vitest";
import { tantrumActions } from "./tantrum-actions.js";
import { makeDwarf, makeItem, makeContext } from "../__tests__/test-helpers.js";
import { createRng } from "../rng.js";

/** Make a dwarf in tantrum with specified stress at a fixed position. */
function makeTantrumDwarf(stress: number, id?: string) {
  return makeDwarf({
    id,
    is_in_tantrum: true,
    stress_level: stress,
    position_x: 5,
    position_y: 5,
    position_z: 0,
    health: 100,
  });
}

/** Make a nearby item at the dwarf's tile. */
function makeNearbyItem() {
  return makeItem({ position_x: 6, position_y: 5, position_z: 0, held_by_dwarf_id: null });
}

describe("tantrumActions — item destruction", () => {
  it("destroys a nearby item within 200 distinct seeds (mild tantrum)", async () => {
    let destroyed = false;
    for (let seed = 0; seed < 200; seed++) {
      const dwarf = makeTantrumDwarf(85);
      const item = makeNearbyItem();
      const ctx = makeContext({ dwarves: [dwarf], items: [item] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      if (ctx.state.items.length === 0) {
        destroyed = true;
        break;
      }
    }
    expect(destroyed).toBe(true);
  });

  it("does not destroy an item held by a dwarf", async () => {
    const holder = makeDwarf({ id: "holder" });
    const heldItem = makeItem({ position_x: 5, position_y: 5, position_z: 0, held_by_dwarf_id: holder.id });

    for (let seed = 0; seed < 100; seed++) {
      const rager = makeTantrumDwarf(99);
      const ctx = makeContext({ dwarves: [rager, { ...holder }], items: [{ ...heldItem }] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      expect(ctx.state.items.length).toBe(1);
    }
  });

  it("does not destroy an item on a different z-level", async () => {
    for (let seed = 0; seed < 100; seed++) {
      const rager = makeTantrumDwarf(99);
      const farItem = makeItem({ position_x: 5, position_y: 5, position_z: 1, held_by_dwarf_id: null });
      const ctx = makeContext({ dwarves: [rager], items: [farItem] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      expect(ctx.state.items.length).toBe(1);
    }
  });

  it("fires a discovery event when item is destroyed (within 200 seeds, severe tantrum)", async () => {
    let eventFired = false;
    for (let seed = 0; seed < 200; seed++) {
      const dwarf = makeTantrumDwarf(99);
      const item = makeNearbyItem();
      const ctx = makeContext({ dwarves: [dwarf], items: [item] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      if (ctx.state.pendingEvents.some(e => (e.event_data as Record<string, unknown>)?.action === 'destroy_item')) {
        eventFired = true;
        break;
      }
    }
    expect(eventFired).toBe(true);
  });

  it("does not destroy items when dwarf is not in tantrum", async () => {
    for (let seed = 0; seed < 50; seed++) {
      const dwarf = makeDwarf({ is_in_tantrum: false, stress_level: 99, position_x: 5, position_y: 5, position_z: 0 });
      const item = makeNearbyItem();
      const ctx = makeContext({ dwarves: [dwarf], items: [item] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      expect(ctx.state.items.length).toBe(1);
    }
  });
});

describe("tantrumActions — dwarf attacks", () => {
  it("attacks a nearby dwarf during moderate tantrum within 200 seeds", async () => {
    let attackHappened = false;
    for (let seed = 0; seed < 200; seed++) {
      const rager = makeTantrumDwarf(92);
      const victim = makeDwarf({ id: "victim", position_x: 6, position_y: 5, position_z: 0, health: 100 });
      const ctx = makeContext({ dwarves: [rager, victim] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      const victimAfter = ctx.state.dwarves.find(d => d.id === victim.id);
      if (victimAfter && victimAfter.health < 100) {
        attackHappened = true;
        break;
      }
    }
    expect(attackHappened).toBe(true);
  });

  it("does not attack dwarves during mild tantrum", async () => {
    for (let seed = 0; seed < 100; seed++) {
      const rager = makeTantrumDwarf(85); // mild — below MODERATE threshold
      const victim = makeDwarf({ id: "victim", position_x: 6, position_y: 5, position_z: 0, health: 100 });
      const ctx = makeContext({ dwarves: [rager, victim] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      const victimAfter = ctx.state.dwarves.find(d => d.id === victim.id);
      expect(victimAfter?.health).toBe(100);
    }
  });

  it("applies witness stress to nearby dwarves within 300 seeds (severe tantrum)", async () => {
    let witnessStressed = false;
    for (let seed = 0; seed < 300; seed++) {
      const rager = makeTantrumDwarf(99);
      const victim = makeDwarf({ id: "victim", position_x: 6, position_y: 5, position_z: 0, health: 100 });
      const witness = makeDwarf({ id: "witness", position_x: 7, position_y: 5, position_z: 0, stress_level: 10 });
      const ctx = makeContext({ dwarves: [rager, victim, witness] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      const witnessAfter = ctx.state.dwarves.find(d => d.id === witness.id);
      if (witnessAfter && witnessAfter.stress_level > 10) {
        witnessStressed = true;
        break;
      }
    }
    expect(witnessStressed).toBe(true);
  });

  it("fires an attack event when a dwarf is hit", async () => {
    let attackEvent = false;
    for (let seed = 0; seed < 300; seed++) {
      const rager = makeTantrumDwarf(99);
      const victim = makeDwarf({ id: "v1", position_x: 5, position_y: 6, position_z: 0, health: 100 });
      const ctx = makeContext({ dwarves: [rager, victim] });
      ctx.rng = createRng(seed);
      await tantrumActions(ctx);
      if (ctx.state.pendingEvents.some(e => (e.event_data as Record<string, unknown>)?.action === 'attack_dwarf')) {
        attackEvent = true;
        break;
      }
    }
    expect(attackEvent).toBe(true);
  });
});
