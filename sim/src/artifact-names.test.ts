import { describe, it, expect } from 'vitest';
import { generateArtifactName, randomArtifactCategory, randomArtifactMaterial, randomArtifactQuality } from './artifact-names.js';
import { createRng } from './rng.js';
import type { Dwarf } from '@pwarf/shared';

function makeDwarf(overrides: Partial<Dwarf> = {}): Dwarf {
  return {
    id: 'dwarf-1',
    civilization_id: 'civ-1',
    name: 'Urist',
    surname: 'McStone',
    status: 'alive',
    age: 30,
    gender: 'male',
    need_food: 80,
    need_drink: 80,
    need_sleep: 80,
    need_social: 80,
    need_purpose: 80,
    need_beauty: 80,
    stress_level: 0,
    is_in_tantrum: false,
    health: 100,
    injuries: [],
    memories: [],
    trait_openness: null,
    trait_conscientiousness: null,
    trait_extraversion: null,
    trait_agreeableness: null,
    trait_neuroticism: null,
    religious_devotion: 0,
    faction_id: null,
    born_year: null,
    died_year: null,
    cause_of_death: null,
    current_task_id: null,
    position_x: 5,
    position_y: 5,
    position_z: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('generateArtifactName', () => {
  it('returns a string starting with "The"', () => {
    const dwarf = makeDwarf();
    const rng = createRng(42);
    const name = generateArtifactName(dwarf, rng);
    expect(name).toMatch(/^The /);
  });

  it('includes the dwarf surname in the name', () => {
    const dwarf = makeDwarf({ surname: 'Ironforge' });
    const rng = createRng(42);
    const name = generateArtifactName(dwarf, rng);
    expect(name).toContain('Ironforge');
  });

  it('falls back to dwarf name when surname is null', () => {
    const dwarf = makeDwarf({ name: 'Bomrek', surname: null });
    const rng = createRng(42);
    const name = generateArtifactName(dwarf, rng);
    expect(name).toContain('Bomrek');
  });

  it('is deterministic for same seed', () => {
    const dwarf = makeDwarf();
    const name1 = generateArtifactName(dwarf, createRng(99));
    const name2 = generateArtifactName(dwarf, createRng(99));
    expect(name1).toBe(name2);
  });

  it('varies across seeds', () => {
    const dwarf = makeDwarf();
    const names = new Set(
      Array.from({ length: 20 }, (_, i) => generateArtifactName(dwarf, createRng(i)))
    );
    expect(names.size).toBeGreaterThan(1);
  });
});

describe('randomArtifactCategory', () => {
  it('returns a valid item category', () => {
    const valid = ['weapon', 'armor', 'crafted', 'book', 'gem'];
    const rng = createRng(42);
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(randomArtifactCategory(rng));
    }
  });
});

describe('randomArtifactMaterial', () => {
  it('returns a non-empty string', () => {
    const rng = createRng(42);
    expect(randomArtifactMaterial(rng)).toBeTruthy();
  });
});

describe('randomArtifactQuality', () => {
  it('returns a valid quality', () => {
    const valid = ['fine', 'superior', 'exceptional', 'masterwork', 'artifact'];
    const rng = createRng(42);
    for (let i = 0; i < 20; i++) {
      expect(valid).toContain(randomArtifactQuality(rng));
    }
  });
});
