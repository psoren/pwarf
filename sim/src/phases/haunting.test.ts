import { describe, it, expect } from "vitest";
import { haunting, putGhostToRest } from "./haunting.js";
import { makeDwarf, makeContext } from "../__tests__/test-helpers.js";
import { GHOST_STRESS_PER_TICK, GHOST_HAUNTING_RADIUS } from "@pwarf/shared";

describe("haunting - ghost registration", () => {
  it("does not add alive dwarves to ghostDwarfIds", () => {
    const ctx = makeContext({ dwarves: [makeDwarf({ id: 'd1', status: 'alive' })] });
    haunting(ctx);
    expect(ctx.state.ghostDwarfIds.has('d1')).toBe(false);
  });

  it("adds newly dead dwarves to ghostDwarfIds", () => {
    const ctx = makeContext({ dwarves: [makeDwarf({ id: 'd1', status: 'dead' })] });
    haunting(ctx);
    expect(ctx.state.ghostDwarfIds.has('d1')).toBe(true);
  });

  it("does not double-register an already-tracked ghost", () => {
    const ctx = makeContext({ dwarves: [makeDwarf({ id: 'd1', status: 'dead' })] });
    ctx.state.ghostDwarfIds.add('d1');
    haunting(ctx);
    haunting(ctx);
    expect(ctx.state.ghostDwarfIds.size).toBe(1);
  });
});

describe("haunting - stress application", () => {
  it("applies stress to living dwarves within GHOST_HAUNTING_RADIUS", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', position_x: 0, position_y: 0 });
    const nearby = makeDwarf({ id: 'nearby', status: 'alive', position_x: 2, position_y: 0, stress_level: 0 });
    const ctx = makeContext({ dwarves: [ghost, nearby] });
    ctx.state.ghostDwarfIds.add('ghost');

    haunting(ctx);

    expect(nearby.stress_level).toBe(GHOST_STRESS_PER_TICK);
    expect(ctx.state.dirtyDwarfIds.has('nearby')).toBe(true);
  });

  it("does not apply stress to dwarves outside GHOST_HAUNTING_RADIUS", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', position_x: 0, position_y: 0 });
    const far = makeDwarf({ id: 'far', status: 'alive', position_x: GHOST_HAUNTING_RADIUS + 5, position_y: 0, stress_level: 0 });
    const ctx = makeContext({ dwarves: [ghost, far] });
    ctx.state.ghostDwarfIds.add('ghost');

    haunting(ctx);

    expect(far.stress_level).toBe(0);
  });

  it("does not apply stress to the ghost itself", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', position_x: 0, position_y: 0, stress_level: 0 });
    const ctx = makeContext({ dwarves: [ghost] });
    ctx.state.ghostDwarfIds.add('ghost');

    haunting(ctx);
    expect(ghost.stress_level).toBe(0);
  });

  it("does nothing when no ghosts exist", () => {
    const dwarf = makeDwarf({ id: 'd1', status: 'alive', stress_level: 5 });
    const ctx = makeContext({ dwarves: [dwarf] });

    haunting(ctx);

    expect(dwarf.stress_level).toBe(5);
  });

  it("stress is capped at MAX_NEED (100)", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', position_x: 0, position_y: 0 });
    const nearby = makeDwarf({ id: 'nearby', status: 'alive', position_x: 0, position_y: 0, stress_level: 100 });
    const ctx = makeContext({ dwarves: [ghost, nearby] });
    ctx.state.ghostDwarfIds.add('ghost');

    haunting(ctx);

    expect(nearby.stress_level).toBe(100);
  });

  it("accumulates stress from multiple ghosts", () => {
    const ghost1 = makeDwarf({ id: 'g1', status: 'dead', position_x: 0, position_y: 0 });
    const ghost2 = makeDwarf({ id: 'g2', status: 'dead', position_x: 1, position_y: 0 });
    const victim = makeDwarf({ id: 'v', status: 'alive', position_x: 0, position_y: 0, stress_level: 0 });
    const ctx = makeContext({ dwarves: [ghost1, ghost2, victim] });
    ctx.state.ghostDwarfIds.add('g1');
    ctx.state.ghostDwarfIds.add('g2');

    haunting(ctx);

    expect(victim.stress_level).toBe(GHOST_STRESS_PER_TICK * 2);
  });
});

describe("putGhostToRest", () => {
  it("does nothing when no ghosts exist", () => {
    const ctx = makeContext({ dwarves: [] });
    putGhostToRest(0, 0, 'Urist', ctx);
    expect(ctx.state.pendingEvents).toHaveLength(0);
  });

  it("removes the nearest ghost from ghostDwarfIds", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', position_x: 5, position_y: 5 });
    const ctx = makeContext({ dwarves: [ghost] });
    ctx.state.ghostDwarfIds.add('ghost');

    putGhostToRest(5, 5, 'Urist', ctx);

    expect(ctx.state.ghostDwarfIds.has('ghost')).toBe(false);
  });

  it("fires a discovery event naming the ghost and engraver", () => {
    const ghost = makeDwarf({ id: 'ghost', status: 'dead', name: 'Melbil', surname: 'Ironstrike', position_x: 0, position_y: 0 });
    const ctx = makeContext({ dwarves: [ghost] });
    ctx.state.ghostDwarfIds.add('ghost');

    putGhostToRest(0, 0, 'Urist', ctx);

    const evt = ctx.state.pendingEvents.find(e =>
      (e.event_data as Record<string, unknown>)?.type === 'ghost_laid_to_rest'
    );
    expect(evt).toBeDefined();
    expect(evt?.description).toContain('Urist');
    expect(evt?.description).toContain('Melbil');
  });

  it("picks the nearest ghost when multiple ghosts exist", () => {
    const nearGhost = makeDwarf({ id: 'near', status: 'dead', position_x: 2, position_y: 0 });
    const farGhost = makeDwarf({ id: 'far', status: 'dead', position_x: 20, position_y: 0 });
    const ctx = makeContext({ dwarves: [nearGhost, farGhost] });
    ctx.state.ghostDwarfIds.add('near');
    ctx.state.ghostDwarfIds.add('far');

    putGhostToRest(0, 0, 'Urist', ctx);

    expect(ctx.state.ghostDwarfIds.has('near')).toBe(false);
    expect(ctx.state.ghostDwarfIds.has('far')).toBe(true);
  });

  it("category of the event is 'discovery'", () => {
    const ghost = makeDwarf({ id: 'g', status: 'dead', position_x: 0, position_y: 0 });
    const ctx = makeContext({ dwarves: [ghost] });
    ctx.state.ghostDwarfIds.add('g');

    putGhostToRest(0, 0, 'Urist', ctx);

    const evt = ctx.state.pendingEvents.find(e =>
      (e.event_data as Record<string, unknown>)?.type === 'ghost_laid_to_rest'
    );
    expect(evt?.category).toBe('discovery');
  });
});
