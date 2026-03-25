import { describe, it, expect, beforeEach } from 'vitest';
import { idleBehavior } from './idle-behavior.js';
import { makeContext, makeDwarf, makeTask, makeStructure, makeMapTile } from '../__tests__/test-helpers.js';
import type { SimContext } from '../sim-context.js';
import { IDLE_BEHAVIOR_COOLDOWN_TICKS } from '@pwarf/shared';

function makeCtx(overrides?: Parameters<typeof makeContext>[0], seed?: number): SimContext {
  return makeContext(overrides, seed);
}

describe('idleBehavior', () => {
  it('creates a wander task for an idle dwarf with no other options', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    await idleBehavior(ctx);

    const newTasks = ctx.state.newTasks;
    expect(newTasks.length).toBe(1);
    expect(newTasks[0].task_type).toBe('wander');
    expect(newTasks[0].priority).toBe(1);
  });

  it('may create a farm_till task when a soil tile exists', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_conscientiousness: 1.0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    // Add soil tile override
    ctx.state.fortressTileOverrides.set('3,3,0', makeMapTile(3, 3, 0, 'soil'));

    // Run multiple times to increase chance of farm_till being selected
    let farmTillCreated = false;
    for (let i = 0; i < 50; i++) {
      const testCtx = makeCtx({ dwarves: [dwarf] }, i);
      testCtx.state.fortressTileOverrides.set('3,3,0', makeMapTile(3, 3, 0, 'soil'));
      await idleBehavior(testCtx);
      if (testCtx.state.newTasks.some(t => t.task_type === 'farm_till')) {
        farmTillCreated = true;
        break;
      }
    }
    expect(farmTillCreated).toBe(true);
  });

  it('may create a socialize task when another alive dwarf is nearby', async () => {
    const dwarf1 = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 1.0 });
    const dwarf2 = makeDwarf({ position_x: 8, position_y: 8, position_z: 0 });

    let socializeCreated = false;
    for (let i = 0; i < 50; i++) {
      const testCtx = makeCtx({ dwarves: [dwarf1, dwarf2] }, i);
      await idleBehavior(testCtx);
      if (testCtx.state.newTasks.some(t => t.task_type === 'socialize')) {
        socializeCreated = true;
        break;
      }
    }
    expect(socializeCreated).toBe(true);
  });

  it('may create a rest task when a completed well structure exists', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 10, position_y: 10, position_z: 0 });

    let restCreated = false;
    for (let i = 0; i < 50; i++) {
      const testCtx = makeCtx({ dwarves: [dwarf], structures: [well] }, i);
      await idleBehavior(testCtx);
      if (testCtx.state.newTasks.some(t => t.task_type === 'rest')) {
        restCreated = true;
        break;
      }
    }
    expect(restCreated).toBe(true);
  });

  it('does not create a task if dwarf is within cooldown', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    // Set cooldown as if just completed an idle task
    ctx.step = 100;
    ctx.state._idleCooldowns.set(dwarf.id, 90); // only 10 ticks ago

    await idleBehavior(ctx);

    expect(ctx.state.newTasks.length).toBe(0);
  });

  it('does not create a task when exactly at the cooldown boundary', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    // Set cooldown to 1 tick before expiry (step - last = 49, which is < 50)
    ctx.step = 100;
    ctx.state._idleCooldowns.set(dwarf.id, 51); // 100 - 51 = 49, still in cooldown

    await idleBehavior(ctx);
    expect(ctx.state.newTasks.length).toBe(0);
  });

  it('creates a task after cooldown expires', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    ctx.step = 200;
    ctx.state._idleCooldowns.set(dwarf.id, 100); // 100 ticks ago, beyond cooldown of 50

    await idleBehavior(ctx);
    expect(ctx.state.newTasks.length).toBe(1);
  });

  it('skips non-idle dwarves (has a task)', async () => {
    const task = makeTask('mine', { status: 'claimed' });
    const dwarf = makeDwarf({ current_task_id: task.id, position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf], tasks: [task] });

    await idleBehavior(ctx);

    expect(ctx.state.newTasks.length).toBe(0);
  });

  it('skips dead dwarves', async () => {
    const dwarf = makeDwarf({ status: 'dead', position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    await idleBehavior(ctx);

    expect(ctx.state.newTasks.length).toBe(0);
  });

  it('skips tantruming dwarves', async () => {
    const dwarf = makeDwarf({ is_in_tantrum: true, position_x: 5, position_y: 5, position_z: 0 });
    const ctx = makeCtx({ dwarves: [dwarf] });

    await idleBehavior(ctx);

    expect(ctx.state.newTasks.length).toBe(0);
  });

  it('high extraversion dwarf selects socialize more often than low extraversion', async () => {
    const dwarf2 = makeDwarf({ position_x: 8, position_y: 8, position_z: 0 });
    const well = makeStructure({ type: 'well', completion_pct: 100, position_x: 20, position_y: 20, position_z: 0 });

    const ITERATIONS = 200;

    let highExtraversionSocialize = 0;
    let lowExtraversionSocialize = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      // High extraversion dwarf
      const highExtDwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 0.95 });
      const highCtx = makeCtx({ dwarves: [highExtDwarf, dwarf2], structures: [well] }, i * 7 + 1);
      await idleBehavior(highCtx);
      if (highCtx.state.newTasks.some(t => t.task_type === 'socialize')) highExtraversionSocialize++;

      // Low extraversion dwarf
      const lowExtDwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_extraversion: 0.05 });
      const lowCtx = makeCtx({ dwarves: [lowExtDwarf, dwarf2], structures: [well] }, i * 7 + 2);
      await idleBehavior(lowCtx);
      if (lowCtx.state.newTasks.some(t => t.task_type === 'socialize')) lowExtraversionSocialize++;
    }

    // High extraversion dwarves should socialize significantly more
    expect(highExtraversionSocialize).toBeGreaterThan(lowExtraversionSocialize);
  });

  it('does not create a farm_till task if soil tile already has a pending farm_till task', async () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, trait_conscientiousness: 1.0 });
    const existingFarmTask = makeTask('farm_till', {
      status: 'pending',
      target_x: 3,
      target_y: 3,
      target_z: 0,
    });

    let farmTillDuplicated = false;
    for (let i = 0; i < 50; i++) {
      const testCtx = makeCtx({ dwarves: [dwarf], tasks: [existingFarmTask] }, i);
      testCtx.state.fortressTileOverrides.set('3,3,0', makeMapTile(3, 3, 0, 'soil'));
      await idleBehavior(testCtx);
      // The only new tasks should be non-farm_till (wander since soil is already targeted)
      if (testCtx.state.newTasks.some(t => t.task_type === 'farm_till')) {
        farmTillDuplicated = true;
        break;
      }
    }
    // farm_till should never be created for a soil tile that already has one
    expect(farmTillDuplicated).toBe(false);
  });
});
