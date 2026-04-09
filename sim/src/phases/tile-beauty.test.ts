import { describe, it, expect } from 'vitest';
import { restoreMorale } from './need-satisfaction.js';
import { makeDwarf, makeStructure } from '../__tests__/test-helpers.js';
import type { FortressTileType } from '@pwarf/shared';

function gridLookup(tiles: Map<string, FortressTileType>) {
  return (x: number, y: number, z: number): FortressTileType | null => {
    return tiles.get(`${x},${y},${z}`) ?? null;
  };
}

describe('tile-based beauty modifiers', () => {
  it('flowers boost morale', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const tiles = new Map<string, FortressTileType>();
    tiles.set('5,5,0', 'flower');
    tiles.set('5,6,0', 'flower');
    tiles.set('6,5,0', 'flower');

    restoreMorale(dwarf, [], [], gridLookup(tiles));
    expect(dwarf.need_social).toBeGreaterThan(50);
  });

  it('glowing moss boosts morale', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const tiles = new Map<string, FortressTileType>();
    tiles.set('5,5,0', 'glowing_moss');

    restoreMorale(dwarf, [], [], gridLookup(tiles));
    expect(dwarf.need_social).toBeGreaterThan(50);
  });

  it('spring boosts morale', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const tiles = new Map<string, FortressTileType>();
    tiles.set('5,5,0', 'spring');

    restoreMorale(dwarf, [], [], gridLookup(tiles));
    expect(dwarf.need_social).toBeGreaterThan(50);
  });

  it('mud decreases morale', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const tiles = new Map<string, FortressTileType>();
    // Surround dwarf with mud
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        tiles.set(`${5 + dx},${5 + dy},0`, 'mud');
      }
    }

    restoreMorale(dwarf, [], [], gridLookup(tiles));
    expect(dwarf.need_social).toBeLessThan(50);
  });

  it('flower field restores more than a single flower', () => {
    const dwarfSingle = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const singleTile = new Map<string, FortressTileType>();
    singleTile.set('5,5,0', 'flower');

    const dwarfField = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const fieldTiles = new Map<string, FortressTileType>();
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        fieldTiles.set(`${5 + dx},${5 + dy},0`, 'flower');
      }
    }

    restoreMorale(dwarfSingle, [], [], gridLookup(singleTile));
    restoreMorale(dwarfField, [], [], gridLookup(fieldTiles));

    expect(dwarfField.need_social).toBeGreaterThan(dwarfSingle.need_social);
  });

  it('openness trait amplifies tile beauty effects', () => {
    const openDwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50, trait_openness: 1.0 });
    const closedDwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50, trait_openness: 0.0 });
    const tiles = new Map<string, FortressTileType>();
    tiles.set('5,5,0', 'flower');
    tiles.set('5,6,0', 'flower');
    tiles.set('6,5,0', 'flower');

    restoreMorale(openDwarf, [], [], gridLookup(tiles));
    restoreMorale(closedDwarf, [], [], gridLookup(tiles));

    expect(openDwarf.need_social).toBeGreaterThan(closedDwarf.need_social);
  });

  it('tiles beyond TILE_BEAUTY_RADIUS have no effect', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    const tiles = new Map<string, FortressTileType>();
    // Place flowers far away (beyond radius 3)
    tiles.set('5,10,0', 'flower');
    tiles.set('10,5,0', 'flower');

    restoreMorale(dwarf, [], [], gridLookup(tiles));
    expect(dwarf.need_social).toBe(50); // No change
  });

  it('no tile lookup means no tile effect (backward compat)', () => {
    const dwarf = makeDwarf({ position_x: 5, position_y: 5, position_z: 0, need_social: 50 });
    restoreMorale(dwarf, [], []);
    expect(dwarf.need_social).toBe(50);
  });
});
