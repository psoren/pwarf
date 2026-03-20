import { describe, it, expect } from 'vitest';
import { createImmigrantDwarf } from './dwarf-factory.js';
import { createRng } from './rng.js';
import { SURFACE_Z, DWARF_FIRST_NAMES, DWARF_SURNAMES } from '@pwarf/shared';

describe('createImmigrantDwarf', () => {
  const rng = createRng(42);

  it('creates an alive dwarf at the specified spawn position', () => {
    const d = createImmigrantDwarf(rng, 'civ-1', 3, 100, 200);
    expect(d.status).toBe('alive');
    expect(d.position_x).toBe(100);
    expect(d.position_y).toBe(200);
    expect(d.position_z).toBe(SURFACE_Z);
    expect(d.civilization_id).toBe('civ-1');
  });

  it('assigns a name from the shared name lists', () => {
    const rng2 = createRng(7);
    const d = createImmigrantDwarf(rng2, 'civ-1', 2, 50, 50);
    expect(DWARF_FIRST_NAMES).toContain(d.name);
    expect(DWARF_SURNAMES).toContain(d.surname);
  });

  it('assigns age 20–40', () => {
    const rng3 = createRng(99);
    for (let i = 0; i < 20; i++) {
      const d = createImmigrantDwarf(rng3, 'civ-1', 5, 0, 0);
      expect(d.age).toBeGreaterThanOrEqual(20);
      expect(d.age).toBeLessThanOrEqual(40);
    }
  });

  it('assigns personality traits as floats in [0, 1]', () => {
    const rng4 = createRng(13);
    const d = createImmigrantDwarf(rng4, 'civ-1', 2, 0, 0);
    for (const trait of [d.trait_openness, d.trait_conscientiousness, d.trait_extraversion, d.trait_agreeableness, d.trait_neuroticism]) {
      expect(trait).not.toBeNull();
      expect(trait!).toBeGreaterThanOrEqual(0);
      expect(trait!).toBeLessThanOrEqual(1);
    }
  });

  it('assigns full needs on arrival', () => {
    const rng5 = createRng(1);
    const d = createImmigrantDwarf(rng5, 'civ-1', 2, 0, 0);
    expect(d.need_food).toBe(80);
    expect(d.need_drink).toBe(80);
    expect(d.need_sleep).toBe(80);
  });

  it('has no current task and zero stress', () => {
    const rng6 = createRng(2);
    const d = createImmigrantDwarf(rng6, 'civ-1', 2, 0, 0);
    expect(d.current_task_id).toBeNull();
    expect(d.stress_level).toBe(0);
    expect(d.is_in_tantrum).toBe(false);
  });
});
