import { describe, it, expect } from 'vitest';
import {
  getMemories,
  addMemory,
  activeMemories,
  decayMemories,
  createWitnessDeathMemories,
  createArtifactMemory,
  createMasterworkMemory,
} from './dwarf-memory.js';
import { makeDwarf, makeContext } from './__tests__/test-helpers.js';
import type { DwarfMemory } from '@pwarf/shared';

function makeMemory(overrides: Partial<DwarfMemory> = {}): DwarfMemory {
  return {
    type: 'witnessed_death',
    intensity: 15,
    year: 1,
    expires_year: 4,
    ...overrides,
  };
}

describe('getMemories', () => {
  it('returns empty array for dwarf with no memories', () => {
    const dwarf = makeDwarf({ memories: [] });
    expect(getMemories(dwarf)).toEqual([]);
  });

  it('returns empty array when memories is not an array', () => {
    const dwarf = makeDwarf({ memories: null as unknown as [] });
    expect(getMemories(dwarf)).toEqual([]);
  });

  it('filters out invalid memory entries', () => {
    const dwarf = makeDwarf({ memories: [{ invalid: true }, makeMemory()] as unknown[] });
    expect(getMemories(dwarf)).toHaveLength(1);
  });

  it('returns valid memories', () => {
    const mem = makeMemory();
    const dwarf = makeDwarf({ memories: [mem] as unknown[] });
    expect(getMemories(dwarf)).toEqual([mem]);
  });
});

describe('addMemory', () => {
  it('adds memory to dwarf memories array', () => {
    const dwarf = makeDwarf({ memories: [] });
    const ctx = makeContext({ dwarves: [dwarf] });
    const mem = makeMemory();

    addMemory(dwarf, mem, ctx.state);

    expect(getMemories(dwarf)).toContainEqual(mem);
  });

  it('marks dwarf dirty', () => {
    const dwarf = makeDwarf({ memories: [] });
    const ctx = makeContext({ dwarves: [dwarf] });

    addMemory(dwarf, makeMemory(), ctx.state);

    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
  });

  it('preserves existing memories', () => {
    const existing = makeMemory({ type: 'created_artifact', intensity: -20 });
    const dwarf = makeDwarf({ memories: [existing] as unknown[] });
    const ctx = makeContext({ dwarves: [dwarf] });

    addMemory(dwarf, makeMemory(), ctx.state);

    expect(getMemories(dwarf)).toHaveLength(2);
  });
});

describe('activeMemories', () => {
  it('returns memories that have not expired', () => {
    const dwarf = makeDwarf({
      memories: [
        makeMemory({ expires_year: 5 }),
        makeMemory({ expires_year: 10 }),
      ] as unknown[],
    });
    expect(activeMemories(dwarf, 5)).toHaveLength(2);
  });

  it('excludes expired memories', () => {
    const dwarf = makeDwarf({
      memories: [
        makeMemory({ expires_year: 3 }),
      ] as unknown[],
    });
    expect(activeMemories(dwarf, 5)).toHaveLength(0);
  });

  it('returns empty array for dwarf with no memories', () => {
    const dwarf = makeDwarf({ memories: [] });
    expect(activeMemories(dwarf, 1)).toEqual([]);
  });
});

describe('decayMemories', () => {
  it('removes expired memories', () => {
    const dwarf = makeDwarf({
      memories: [
        makeMemory({ expires_year: 2 }),
        makeMemory({ expires_year: 10 }),
      ] as unknown[],
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    decayMemories(dwarf, 5, ctx.state);

    expect(getMemories(dwarf)).toHaveLength(1);
    expect(getMemories(dwarf)[0].expires_year).toBe(10);
  });

  it('marks dwarf dirty when memories removed', () => {
    const dwarf = makeDwarf({
      memories: [makeMemory({ expires_year: 2 })] as unknown[],
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    decayMemories(dwarf, 5, ctx.state);

    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(true);
  });

  it('does not mark dwarf dirty when no memories removed', () => {
    const dwarf = makeDwarf({
      memories: [makeMemory({ expires_year: 10 })] as unknown[],
    });
    const ctx = makeContext({ dwarves: [dwarf] });

    decayMemories(dwarf, 5, ctx.state);

    expect(ctx.state.dirtyDwarfIds.has(dwarf.id)).toBe(false);
  });
});

describe('createWitnessDeathMemories', () => {
  it('adds witnessed_death memory to nearby dwarves', () => {
    const deceased = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    deceased.status = 'dead';
    const witness = makeDwarf({ position_x: 7, position_y: 5, position_z: 0 }); // dist=2
    const ctx = makeContext({ dwarves: [deceased, witness] });

    createWitnessDeathMemories(deceased, ctx.state, 1);

    const mems = getMemories(witness);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('witnessed_death');
    expect(mems[0].intensity).toBeGreaterThan(0);
  });

  it('does not add memory to dwarves beyond radius', () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    deceased.status = 'dead';
    const farWitness = makeDwarf({ position_x: 20, position_y: 0, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, farWitness] });

    createWitnessDeathMemories(deceased, ctx.state, 1);

    expect(getMemories(farWitness)).toHaveLength(0);
  });

  it('does not add memory to the deceased', () => {
    const deceased = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased] });

    createWitnessDeathMemories(deceased, ctx.state, 1);

    expect(getMemories(deceased)).toHaveLength(0);
  });

  it('does not add memory to dead witnesses', () => {
    const deceased = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    deceased.status = 'dead';
    const deadWitness = makeDwarf({ status: 'dead', position_x: 6, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [deceased, deadWitness] });

    createWitnessDeathMemories(deceased, ctx.state, 1);

    expect(getMemories(deadWitness)).toHaveLength(0);
  });

  it('does not add memory across z-levels', () => {
    const deceased = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    deceased.status = 'dead';
    const upperWitness = makeDwarf({ position_x: 5, position_y: 5, position_z: 1 });
    const ctx = makeContext({ dwarves: [deceased, upperWitness] });

    createWitnessDeathMemories(deceased, ctx.state, 1);

    expect(getMemories(upperWitness)).toHaveLength(0);
  });
});

describe('createArtifactMemory', () => {
  it('adds created_artifact memory with negative intensity', () => {
    const dwarf = makeDwarf({ memories: [] });
    const ctx = makeContext({ dwarves: [dwarf] });

    createArtifactMemory(dwarf, ctx.state, 5);

    const mems = getMemories(dwarf);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('created_artifact');
    expect(mems[0].intensity).toBeLessThan(0);
    expect(mems[0].year).toBe(5);
  });
});

describe('createMasterworkMemory', () => {
  it('adds created_masterwork memory with negative intensity', () => {
    const dwarf = makeDwarf({ memories: [] });
    const ctx = makeContext({ dwarves: [dwarf] });

    createMasterworkMemory(dwarf, ctx.state, 3);

    const mems = getMemories(dwarf);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('created_masterwork');
    expect(mems[0].intensity).toBeLessThan(0);
  });
});
