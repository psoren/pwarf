import { describe, it, expect } from 'vitest';
import { generateArtifactName, randomArtifactCategory, randomArtifactMaterial, randomArtifactQuality } from './artifact-names.js';
import { createRng } from './rng.js';
import { makeDwarf } from './__tests__/test-helpers.js';

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
