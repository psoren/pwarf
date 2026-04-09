import { describe, it, expect } from 'vitest';
import { createFortressDeriver, FORTRESS_SIZE } from './fortress-gen-helpers.js';

describe('tile variety Phase 1', () => {
  const SEED = 42n;
  const CIV = 'test-civ';

  it('surface generates flowers on grassland', () => {
    const d = createFortressDeriver(SEED, CIV);
    let flowerCount = 0;
    for (let x = 0; x < FORTRESS_SIZE; x += 2) {
      for (let y = 0; y < FORTRESS_SIZE; y += 2) {
        if (d.deriveTile(x, y, 0).tileType === 'flower') flowerCount++;
      }
    }
    expect(flowerCount).toBeGreaterThan(0);
  });

  it('surface generates springs (rare)', () => {
    const d = createFortressDeriver(SEED, CIV);
    let springCount = 0;
    for (let x = 0; x < FORTRESS_SIZE; x += 2) {
      for (let y = 0; y < FORTRESS_SIZE; y += 2) {
        if (d.deriveTile(x, y, 0).tileType === 'spring') springCount++;
      }
    }
    // Springs should be rare — at least 1 somewhere on a 512×512 map
    expect(springCount).toBeGreaterThan(0);
    // But not too common
    expect(springCount).toBeLessThan(1000);
  });

  it('caves generate crystal deposits', () => {
    const d = createFortressDeriver(SEED, CIV);
    const entrances = d.entrances;
    if (entrances.length === 0) return; // Skip if no caves on this seed

    let crystalCount = 0;
    const e = entrances[0];
    for (let x = e.x - 50; x < e.x + 50; x++) {
      for (let y = e.y - 50; y < e.y + 50; y++) {
        if (d.deriveTile(x, y, e.z).tileType === 'crystal') crystalCount++;
      }
    }
    expect(crystalCount).toBeGreaterThan(0);
  });

  it('caves generate glowing moss', () => {
    const d = createFortressDeriver(SEED, CIV);
    const entrances = d.entrances;
    if (entrances.length === 0) return;

    let mossCount = 0;
    const e = entrances[0];
    for (let x = e.x - 50; x < e.x + 50; x++) {
      for (let y = e.y - 50; y < e.y + 50; y++) {
        if (d.deriveTile(x, y, e.z).tileType === 'glowing_moss') mossCount++;
      }
    }
    expect(mossCount).toBeGreaterThan(0);
  });

  it('caves generate fungal growth', () => {
    const d = createFortressDeriver(SEED, CIV);
    const entrances = d.entrances;
    if (entrances.length === 0) return;

    let fungalCount = 0;
    const e = entrances[0];
    for (let x = e.x - 50; x < e.x + 50; x++) {
      for (let y = e.y - 50; y < e.y + 50; y++) {
        if (d.deriveTile(x, y, e.z).tileType === 'fungal_growth') fungalCount++;
      }
    }
    expect(fungalCount).toBeGreaterThan(0);
  });

  it('crystal mining produces crystal shard', () => {
    // Crystal tiles should be minable
    // This is tested via getMineProduct in task-completion, but let's verify the type exists
    const d = createFortressDeriver(SEED, CIV);
    const entrances = d.entrances;
    if (entrances.length === 0) return;

    const e = entrances[0];
    let foundCrystal = false;
    for (let x = e.x - 50; x < e.x + 50; x++) {
      for (let y = e.y - 50; y < e.y + 50; y++) {
        const tile = d.deriveTile(x, y, e.z);
        if (tile.tileType === 'crystal') {
          expect(tile.material).toBe('crystal');
          foundCrystal = true;
          break;
        }
      }
      if (foundCrystal) break;
    }
    expect(foundCrystal).toBe(true);
  });
});
