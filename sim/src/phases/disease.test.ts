import { describe, it, expect } from "vitest";
import { diseasePhase, hasWell } from "./disease.js";
import { createTestContext } from "../sim-context.js";
import { createRng } from "../rng.js";
import { makeDwarf, makeStructure } from "../__tests__/test-helpers.js";

describe("hasWell", () => {
  it("returns false when no structures", () => {
    const ctx = createTestContext();
    expect(hasWell(ctx)).toBe(false);
  });

  it("returns false when well is incomplete", () => {
    const ctx = createTestContext({ structures: [makeStructure({ type: 'well', completion_pct: 50 })] });
    expect(hasWell(ctx)).toBe(false);
  });

  it("returns true when a completed well exists", () => {
    const ctx = createTestContext({ structures: [makeStructure({ type: 'well', completion_pct: 100 })] });
    expect(hasWell(ctx)).toBe(true);
  });
});

describe("diseasePhase - outbreak", () => {
  it("fires outbreak event and infects patient zero across seeds", () => {
    let found = false;
    for (let seed = 0; seed < 500; seed++) {
      const dwarf = makeDwarf({ id: 'd1' });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      diseasePhase(ctx);
      if (ctx.state.infectedDwarfIds.has('d1')) {
        const evt = ctx.state.pendingEvents.find(e =>
          (e.event_data as Record<string, unknown>)?.type === 'disease_outbreak'
        );
        expect(evt).toBeDefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("does not trigger outbreak when already infected", () => {
    for (let seed = 0; seed < 200; seed++) {
      const dwarf = makeDwarf({ id: 'd1' });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      const outbreakEvts = ctx.state.pendingEvents.filter(e =>
        (e.event_data as Record<string, unknown>)?.type === 'disease_outbreak'
      );
      expect(outbreakEvts).toHaveLength(0);
    }
  });

  it("does nothing when no dwarves exist", () => {
    for (let seed = 0; seed < 100; seed++) {
      const ctx = createTestContext({ dwarves: [] });
      ctx.rng = createRng(seed);
      diseasePhase(ctx);
      expect(ctx.state.infectedDwarfIds.size).toBe(0);
      expect(ctx.state.pendingEvents).toHaveLength(0);
    }
  });
});

describe("diseasePhase - health damage", () => {
  it("deals 15 health damage per year to infected dwarf", () => {
    // Use a seed where recovery doesn't happen
    for (let seed = 0; seed < 500; seed++) {
      const dwarf = makeDwarf({ id: 'd1', health: 100 });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (dwarf.health < 100) {
        expect(dwarf.health).toBe(85);
        return;
      }
    }
  });

  it("marks dwarf dirty after taking disease damage", () => {
    for (let seed = 0; seed < 500; seed++) {
      const dwarf = makeDwarf({ id: 'd1', health: 100 });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (dwarf.health < 100) {
        expect(ctx.state.dirtyDwarfIds.has('d1')).toBe(true);
        return;
      }
    }
  });

  it("kills dwarf when health reaches 0 and fires death event", () => {
    // 10 hp - 15 damage = guaranteed death
    let found = false;
    for (let seed = 0; seed < 500; seed++) {
      const dwarf = makeDwarf({ id: 'd1', health: 10 });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (dwarf.status === 'dead') {
        expect(dwarf.cause_of_death).toBe('disease');
        expect(ctx.state.infectedDwarfIds.has('d1')).toBe(false);
        const deathEvt = ctx.state.pendingEvents.find(e => e.category === 'death');
        expect(deathEvt).toBeDefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("diseasePhase - recovery", () => {
  it("removes dwarf from infected set on natural recovery", () => {
    let found = false;
    for (let seed = 0; seed < 500; seed++) {
      const dwarf = makeDwarf({ id: 'd1', health: 80 });
      const ctx = createTestContext({ dwarves: [dwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (!ctx.state.infectedDwarfIds.has('d1') && dwarf.status === 'alive') {
        const recoveryEvt = ctx.state.pendingEvents.find(e =>
          (e.event_data as Record<string, unknown>)?.type === 'disease_recovery'
        );
        expect(recoveryEvt).toBeDefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

describe("diseasePhase - spread", () => {
  it("can spread from infected dwarf to nearby healthy dwarf", () => {
    let spreadOccurred = false;
    for (let seed = 0; seed < 500; seed++) {
      const infected = makeDwarf({ id: 'd1', position_x: 0, position_y: 0 });
      const healthy = makeDwarf({ id: 'd2', position_x: 2, position_y: 0 });
      const ctx = createTestContext({ dwarves: [infected, healthy] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (ctx.state.infectedDwarfIds.has('d2')) {
        spreadOccurred = true;
        break;
      }
    }
    expect(spreadOccurred).toBe(true);
  });

  it("does not spread to dwarves beyond DISEASE_SPREAD_RADIUS", () => {
    for (let seed = 0; seed < 200; seed++) {
      const infected = makeDwarf({ id: 'd1', position_x: 0, position_y: 0 });
      const farDwarf = makeDwarf({ id: 'd2', position_x: 10, position_y: 10 });
      const ctx = createTestContext({ dwarves: [infected, farDwarf] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      expect(ctx.state.infectedDwarfIds.has('d2')).toBe(false);
    }
  });

  it("fires spread event when disease spreads to a new dwarf", () => {
    let found = false;
    for (let seed = 0; seed < 500; seed++) {
      const infected = makeDwarf({ id: 'd1', position_x: 0, position_y: 0 });
      const healthy = makeDwarf({ id: 'd2', position_x: 1, position_y: 0 });
      const ctx = createTestContext({ dwarves: [infected, healthy] });
      ctx.rng = createRng(seed);
      ctx.state.infectedDwarfIds.add('d1');
      diseasePhase(ctx);
      if (ctx.state.infectedDwarfIds.has('d2')) {
        const spreadEvt = ctx.state.pendingEvents.find(e =>
          (e.event_data as Record<string, unknown>)?.type === 'disease_spread'
        );
        expect(spreadEvt).toBeDefined();
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
