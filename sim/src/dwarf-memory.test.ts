import { describe, it, expect } from 'vitest';
import {
  getMemories,
  addMemory,
  activeMemories,
  decayMemories,
  createWitnessDeathMemories,
  createGriefFriendMemories,
  createGriefSpouseMemories,
  createMarriageMemories,
  createArtifactMemory,
  createMasterworkMemory,
} from './dwarf-memory.js';
import { makeDwarf, makeRelationship, makeContext } from './__tests__/test-helpers.js';
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

describe('createGriefFriendMemories', () => {
  it('adds grief_friend memory and immediate stress to alive friends of the deceased', () => {
    const deceased = makeDwarf({ position_x: 0, position_y: 0, position_z: 0 });
    const friend = makeDwarf({ memories: [], stress_level: 0 });
    const rel = makeRelationship(deceased.id, friend.id, 'friend');
    const ctx = makeContext({ dwarves: [deceased, friend] });
    ctx.state.dwarfRelationships.push(rel);
    deceased.status = 'dead';

    createGriefFriendMemories(deceased, ctx.state, 2);

    const mems = getMemories(friend);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('grief_friend');
    expect(mems[0].intensity).toBeGreaterThan(0);
    expect(mems[0].year).toBe(2);
    expect(friend.stress_level).toBeGreaterThan(0);
  });

  it('does not add grief to dwarves with only acquaintance relationship', () => {
    const deceased = makeDwarf();
    const acquaintance = makeDwarf({ memories: [] });
    const rel = makeRelationship(deceased.id, acquaintance.id, 'acquaintance');
    const ctx = makeContext({ dwarves: [deceased, acquaintance] });
    ctx.state.dwarfRelationships.push(rel);
    deceased.status = 'dead';

    createGriefFriendMemories(deceased, ctx.state, 2);

    expect(getMemories(acquaintance)).toHaveLength(0);
  });

  it('does not add grief to already-dead dwarves', () => {
    const deceased = makeDwarf({ status: 'dead' });
    const deadFriend = makeDwarf({ status: 'dead', memories: [] });
    const rel = makeRelationship(deceased.id, deadFriend.id, 'friend');
    const ctx = makeContext({ dwarves: [deceased, deadFriend] });
    ctx.state.dwarfRelationships.push(rel);

    createGriefFriendMemories(deceased, ctx.state, 2);

    expect(getMemories(deadFriend)).toHaveLength(0);
  });

  it('works when deceased is dwarf_b_id in the relationship', () => {
    const friend = makeDwarf({ memories: [] });
    const deceased = makeDwarf({ status: 'dead' });
    // Ensure deceased ends up as b by forcing canonical order
    const rel = makeRelationship(friend.id, deceased.id, 'friend');
    const ctx = makeContext({ dwarves: [friend, deceased] });
    ctx.state.dwarfRelationships.push(rel);

    createGriefFriendMemories(deceased, ctx.state, 3);

    const mems = getMemories(friend);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('grief_friend');
  });
});

describe('createGriefSpouseMemories', () => {
  it('adds grief_spouse memory and immediate stress to surviving spouse', () => {
    const deceased = makeDwarf({ status: 'dead' });
    const spouse = makeDwarf({ memories: [], stress_level: 0 });
    const rel = makeRelationship(deceased.id, spouse.id, 'spouse');
    const ctx = makeContext({ dwarves: [deceased, spouse] });
    ctx.state.dwarfRelationships.push(rel);

    createGriefSpouseMemories(deceased, ctx.state, 5);

    const mems = getMemories(spouse);
    expect(mems).toHaveLength(1);
    expect(mems[0].type).toBe('grief_spouse');
    expect(mems[0].intensity).toBeGreaterThan(0);
    expect(spouse.stress_level).toBeGreaterThan(0);
  });

  it('applies greater stress than friend grief', () => {
    const deceased = makeDwarf({ status: 'dead' });
    const spouse = makeDwarf({ memories: [], stress_level: 0 });
    const rel = makeRelationship(deceased.id, spouse.id, 'spouse');
    const ctx = makeContext({ dwarves: [deceased, spouse] });
    ctx.state.dwarfRelationships.push(rel);

    createGriefSpouseMemories(deceased, ctx.state, 5);

    // GRIEF_SPOUSE_STRESS (35) > GRIEF_FRIEND_STRESS (20)
    expect(spouse.stress_level).toBeGreaterThan(20);
  });

  it('does not affect dwarves with only friend relationships', () => {
    const deceased = makeDwarf({ status: 'dead' });
    const friend = makeDwarf({ memories: [], stress_level: 0 });
    const rel = makeRelationship(deceased.id, friend.id, 'friend');
    const ctx = makeContext({ dwarves: [deceased, friend] });
    ctx.state.dwarfRelationships.push(rel);

    createGriefSpouseMemories(deceased, ctx.state, 5);

    expect(getMemories(friend)).toHaveLength(0);
    expect(friend.stress_level).toBe(0);
  });
});

describe('createMarriageMemories', () => {
  it('adds married_joy memory to both spouses', () => {
    const spouseA = makeDwarf({ memories: [] });
    const spouseB = makeDwarf({ memories: [] });
    const ctx = makeContext({ dwarves: [spouseA, spouseB] });

    createMarriageMemories(spouseA, spouseB, ctx.state, 3);

    const memA = getMemories(spouseA);
    const memB = getMemories(spouseB);
    expect(memA).toHaveLength(1);
    expect(memA[0].type).toBe('married_joy');
    expect(memA[0].intensity).toBeLessThan(0);
    expect(memB).toHaveLength(1);
    expect(memB[0].type).toBe('married_joy');
  });
});
