import { describe, it, expect } from 'vitest';
import { idleBehavior, traitMod, selectBehavior } from './idle-behavior.js';
import { makeDwarf, makeTask, makeStructure, makeMapTile, makeContext } from '../__tests__/test-helpers.js';
import { IDLE_BEHAVIOR_COOLDOWN_TICKS } from '@pwarf/shared';
import { buildTileLookup } from '../tile-lookup.js';

describe('traitMod', () => {
  it('returns 1.0 for null traits', () => {
    expect(traitMod(null, 2.0)).toBe(1.0);
  });

  it('returns 1.0 for average trait (0.5)', () => {
    expect(traitMod(0.5, 2.0)).toBe(1.0);
  });

  it('scales up for high traits', () => {
    // 1.0 + (0.9 - 0.5) × 2.0 = 1.8
    expect(traitMod(0.9, 2.0)).toBeCloseTo(1.8);
  });

  it('scales down for low traits (clamped at 0.2)', () => {
    // 1.0 + (0.0 - 0.5) × 2.0 = 0.0 → clamped to 0.2
    expect(traitMod(0.0, 2.0)).toBe(0.2);
  });

  it('clamps to 0.2 minimum', () => {
    expect(traitMod(0.0, 10.0)).toBe(0.2);
  });
});

describe('idleBehavior', () => {
  it('does not create idle tasks when real work is pending', async () => {
    const dwarf = makeDwarf({ need_food: 95, need_drink: 95, need_sleep: 95 });
    const mineTask = makeTask('mine', { status: 'pending', target_x: 5, target_y: 5, target_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], tasks: [mineTask] });

    await idleBehavior(ctx);

    // No new idle tasks should be created
    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const idleTasks = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(idleTasks.length).toBe(0);
  });

  it('does not create idle tasks when real work is in progress', async () => {
    const dwarf1 = makeDwarf({ need_food: 95, need_drink: 95, need_sleep: 95, current_task_id: 'task-1' });
    const dwarf2 = makeDwarf({ need_food: 95, need_drink: 95, need_sleep: 95 });
    const mineTask = makeTask('mine', { status: 'in_progress', assigned_dwarf_id: dwarf1.id });
    mineTask.id = 'task-1';
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2], tasks: [mineTask] });

    await idleBehavior(ctx);

    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const idleTasks = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(idleTasks.length).toBe(0);
  });

  it('respects cooldown between idle tasks', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 });
    const ctx = makeContext({ dwarves: [dwarf] });
    // Set a grass tile at the dwarf's position so tile lookup works
    ctx.state.fortressTileOverrides.set('5,5,0', { id: 'ft-1', civilization_id: 'civ-1', x: 5, y: 5, z: 0, tile_type: 'grass', material: null, is_revealed: true, is_mined: false, created_at: '' });

    // First call should create a task
    await idleBehavior(ctx);
    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const tasks1 = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(tasks1.length).toBeGreaterThan(0);

    // Clear the dwarf's current_task_id to simulate being idle again
    dwarf.current_task_id = null;

    // Second call immediately after should respect cooldown
    const prevTaskCount = ctx.state.tasks.length;
    await idleBehavior(ctx);
    const tasks2 = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(tasks2.length).toBe(tasks1.length); // No new tasks

    // Advance past cooldown
    ctx.step = IDLE_BEHAVIOR_COOLDOWN_TICKS + 1;
    await idleBehavior(ctx);
    const tasks3 = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(tasks3.length).toBeGreaterThan(tasks1.length);
  });

  it('does not create tasks for dwarves in strange moods', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_food: 95, need_drink: 95, need_sleep: 95 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.strangeMoodDwarfIds.add(dwarf.id);

    await idleBehavior(ctx);

    const idleTypes = new Set(['wander', 'socialize', 'rest']);
    const idleTasks = ctx.state.tasks.filter(t => idleTypes.has(t.task_type));
    expect(idleTasks.length).toBe(0);
  });

  it('does not create tasks for dead dwarves', async () => {
    const dwarf = makeDwarf({ status: 'dead', position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });

    await idleBehavior(ctx);

    expect(ctx.state.tasks.length).toBe(0);
  });
});

describe('selectBehavior', () => {
  it('returns wander as fallback when no other options available', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    // Add walkable tiles around the dwarf
    ctx.state.fortressTileOverrides.set('5,5,0', { id: 'ft-1', civilization_id: 'civ-1', x: 5, y: 5, z: 0, tile_type: 'grass', material: null, is_revealed: true, is_mined: false, created_at: '' });
    for (let dx = -10; dx <= 10; dx++) {
      for (let dy = -10; dy <= 10; dy++) {
        const key = `${5 + dx},${5 + dy},0`;
        if (!ctx.state.fortressTileOverrides.has(key)) {
          ctx.state.fortressTileOverrides.set(key, { id: `ft-${key}`, civilization_id: 'civ-1', x: 5 + dx, y: 5 + dy, z: 0, tile_type: 'grass', material: null, is_revealed: true, is_mined: false, created_at: '' });
        }
      }
    }
    const getTile = buildTileLookup(ctx);

    const behavior = selectBehavior(dwarf, ctx, [dwarf], getTile);
    expect(behavior).not.toBeNull();
    expect(behavior!.type).toBe('wander');
  });

  it('can select socialize when another dwarf is nearby', () => {
    const dwarf1 = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 1.0 });
    const dwarf2 = makeDwarf({ position_x: 7, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf1, dwarf2] });
    const getTile = buildTileLookup(ctx);

    // Run multiple times to verify socialize can be selected
    let socializeCount = 0;
    for (let i = 0; i < 50; i++) {
      const behavior = selectBehavior(dwarf1, ctx, [dwarf1, dwarf2], getTile);
      if (behavior?.type === 'socialize') socializeCount++;
    }
    expect(socializeCount).toBeGreaterThan(0);
  });

  it('can select rest when a completed well exists', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_openness: 1.0, trait_extraversion: 0.0 });
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 8, position_y: 8, position_z: 0 });
    const ctx = makeContext({ dwarves: [dwarf], structures: [well] });
    const getTile = buildTileLookup(ctx);

    let restCount = 0;
    for (let i = 0; i < 50; i++) {
      const behavior = selectBehavior(dwarf, ctx, [dwarf], getTile);
      if (behavior?.type === 'rest') restCount++;
    }
    expect(restCount).toBeGreaterThan(0);
  });

  it('can select refarm when soil tiles exist', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_conscientiousness: 1.0 });
    const ctx = makeContext({ dwarves: [dwarf] });
    ctx.state.fortressTileOverrides.set('7,5,0', { id: 'ft-1', civilization_id: 'civ-1', x: 7, y: 5, z: 0, tile_type: 'soil', material: null, is_revealed: true, is_mined: false, created_at: '' });

    const getTile = buildTileLookup(ctx);

    let refarmCount = 0;
    for (let i = 0; i < 50; i++) {
      const behavior = selectBehavior(dwarf, ctx, [dwarf], getTile);
      if (behavior?.type === 'refarm') refarmCount++;
    }
    expect(refarmCount).toBeGreaterThan(0);
  });

  it('high extraversion boosts socialize weight', () => {
    const extrovert = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 1.0 });
    const introvert = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 0.0 });
    const other = makeDwarf({ position_x: 7, position_y: 5, position_z: 0 });
    const ctx = makeContext({ dwarves: [extrovert, introvert, other] });
    const getTile = buildTileLookup(ctx);

    let extrovertSocializes = 0;
    let introvertSocializes = 0;
    for (let i = 0; i < 200; i++) {
      const b1 = selectBehavior(extrovert, ctx, [extrovert, other], getTile);
      if (b1?.type === 'socialize') extrovertSocializes++;
      const b2 = selectBehavior(introvert, ctx, [introvert, other], getTile);
      if (b2?.type === 'socialize') introvertSocializes++;
    }
    // Extrovert should socialize more than introvert
    expect(extrovertSocializes).toBeGreaterThan(introvertSocializes);
  });
});
