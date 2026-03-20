import { describe, it, expect } from 'vitest';
import { yearlyRollup } from '../phases/yearly-rollup.js';
import { createRng } from '../rng.js';
import { createTestContext } from '../sim-context.js';
import { IMMIGRATION_CHANCE_PER_YEAR } from '@pwarf/shared';

describe('yearly immigration', () => {
  it('does not add immigrants in year 1', async () => {
    const ctx = createTestContext();
    ctx.year = 1;
    const before = ctx.state.dwarves.length;
    await yearlyRollup(ctx);
    expect(ctx.state.dwarves.length).toBe(before);
  });

  it('can add immigrants starting from year 2', async () => {
    // Use a seed that guarantees the immigration roll passes
    // IMMIGRATION_CHANCE_PER_YEAR = 0.6, so most seeds will trigger it
    let arrived = false;
    for (let seed = 0; seed < 20; seed++) {
      const ctx = createTestContext();
      ctx.rng = createRng(seed);
      ctx.year = 2;
      const before = ctx.state.dwarves.length;
      await yearlyRollup(ctx);
      if (ctx.state.dwarves.length > before) {
        arrived = true;
        break;
      }
    }
    expect(arrived).toBe(true);
  });

  it('adds 1–3 immigrants per wave', async () => {
    // Try many seeds and confirm all waves are size 1–3
    for (let seed = 0; seed < 50; seed++) {
      const ctx = createTestContext();
      ctx.rng = createRng(seed);
      ctx.year = 5;
      const before = ctx.state.dwarves.length;
      await yearlyRollup(ctx);
      const arrived = ctx.state.dwarves.length - before;
      if (arrived > 0) {
        expect(arrived).toBeGreaterThanOrEqual(1);
        expect(arrived).toBeLessThanOrEqual(3);
      }
    }
  });

  it('fires a migration event when immigrants arrive', async () => {
    let migrationEventFired = false;
    for (let seed = 0; seed < 20; seed++) {
      const ctx = createTestContext();
      ctx.rng = createRng(seed);
      ctx.year = 2;
      await yearlyRollup(ctx);
      if (ctx.state.pendingEvents.some(e => e.category === 'migration')) {
        migrationEventFired = true;
        break;
      }
    }
    expect(migrationEventFired).toBe(true);
  });

  it('marks new immigrants as dirty', async () => {
    for (let seed = 0; seed < 20; seed++) {
      const ctx = createTestContext();
      ctx.rng = createRng(seed);
      ctx.year = 3;
      const beforeIds = new Set(ctx.state.dwarves.map(d => d.id));
      await yearlyRollup(ctx);
      const newDwarves = ctx.state.dwarves.filter(d => !beforeIds.has(d.id));
      if (newDwarves.length > 0) {
        for (const d of newDwarves) {
          expect(ctx.state.dirtyDwarfIds.has(d.id)).toBe(true);
        }
        break;
      }
    }
  });

  it(`immigration probability is ${IMMIGRATION_CHANCE_PER_YEAR}`, () => {
    expect(IMMIGRATION_CHANCE_PER_YEAR).toBe(0.6);
  });
});
