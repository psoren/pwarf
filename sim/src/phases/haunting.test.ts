import { describe, it, expect } from "vitest";
import { haunting } from "./haunting.js";
import { createTestContext } from "../sim-context.js";
import { makeDwarf } from "../__tests__/test-helpers.js";
import { GHOST_STRESS_PER_TICK, GHOST_HAUNTING_RADIUS } from "@pwarf/shared";

describe("haunting", () => {
  it("does nothing when no ghosts exist", () => {
    const dwarf = makeDwarf({ stress_level: 0, position_x: 0, position_y: 0, position_z: 0 });
    const ctx = createTestContext({ dwarves: [dwarf] });
    haunting(ctx);
    expect(dwarf.stress_level).toBe(0);
    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
  });

  it("applies stress to alive dwarves within haunting radius", () => {
    const dwarf = makeDwarf({ id: 'd1', stress_level: 10, position_x: 2, position_y: 2, position_z: 0 });
    const ctx = createTestContext({ dwarves: [dwarf] });
    // Ghost at (0, 0, 0) — distance 4 from dwarf, within GHOST_HAUNTING_RADIUS (5)
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });

    haunting(ctx);

    expect(dwarf.stress_level).toBeCloseTo(10 + GHOST_STRESS_PER_TICK);
    expect(ctx.state.dirtyDwarfIds.has('d1')).toBe(true);
  });

  it("does not apply stress to dwarves beyond haunting radius", () => {
    const farDwarf = makeDwarf({ id: 'd1', stress_level: 10, position_x: 10, position_y: 10, position_z: 0 });
    const ctx = createTestContext({ dwarves: [farDwarf] });
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });

    haunting(ctx);

    // Manhattan distance = 20 > GHOST_HAUNTING_RADIUS (5)
    expect(farDwarf.stress_level).toBe(10);
    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
  });

  it("does not apply stress to dwarves on different z-levels", () => {
    const dwarf = makeDwarf({ id: 'd1', stress_level: 10, position_x: 1, position_y: 1, position_z: 1 });
    const ctx = createTestContext({ dwarves: [dwarf] });
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 1, y: 1, z: 0 }); // same x,y but different z

    haunting(ctx);

    expect(dwarf.stress_level).toBe(10);
    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
  });

  it("caps stress at 100", () => {
    const dwarf = makeDwarf({ id: 'd1', stress_level: 99.9, position_x: 0, position_y: 0, position_z: 0 });
    const ctx = createTestContext({ dwarves: [dwarf] });
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });

    haunting(ctx);

    expect(dwarf.stress_level).toBe(100);
  });

  it("applies stress from multiple ghosts", () => {
    const dwarf = makeDwarf({ id: 'd1', stress_level: 0, position_x: 2, position_y: 0, position_z: 0 });
    const ctx = createTestContext({ dwarves: [dwarf] });
    // Two ghosts both within radius
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });
    ctx.state.ghostDwarfIds.add('ghost2');
    ctx.state.ghostPositions.set('ghost2', { x: 3, y: 0, z: 0 });

    haunting(ctx);

    expect(dwarf.stress_level).toBeCloseTo(GHOST_STRESS_PER_TICK * 2);
  });

  it("ghost at exactly haunting radius boundary still haunts", () => {
    const dwarf = makeDwarf({
      id: 'd1',
      stress_level: 0,
      position_x: GHOST_HAUNTING_RADIUS,
      position_y: 0,
      position_z: 0,
    });
    const ctx = createTestContext({ dwarves: [dwarf] });
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });

    haunting(ctx);

    expect(dwarf.stress_level).toBeCloseTo(GHOST_STRESS_PER_TICK);
  });

  it("does not affect dead dwarves", () => {
    const dead = makeDwarf({ id: 'd1', status: 'dead', stress_level: 0, position_x: 0, position_y: 0, position_z: 0 });
    const ctx = createTestContext({ dwarves: [dead] });
    ctx.state.ghostDwarfIds.add('ghost1');
    ctx.state.ghostPositions.set('ghost1', { x: 0, y: 0, z: 0 });

    haunting(ctx);

    expect(dead.stress_level).toBe(0);
    expect(ctx.state.dirtyDwarfIds.size).toBe(0);
  });
});
