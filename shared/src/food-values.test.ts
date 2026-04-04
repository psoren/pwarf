import { describe, it, expect } from 'vitest';
import { getNutritionValue, getHydrationValue } from './food-values.js';
import { FOOD_RESTORE_AMOUNT, DRINK_RESTORE_AMOUNT, MAX_NEED } from './constants.js';
import type { Item } from './db-types.js';

function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    name: 'Plump helmet',
    category: 'food',
    quality: 'standard',
    material: 'plant',
    weight: 1,
    value: 2,
    is_artifact: false,
    created_by_dwarf_id: null,
    created_in_civ_id: 'civ-1',
    created_year: 1,
    held_by_dwarf_id: null,
    located_in_civ_id: 'civ-1',
    located_in_ruin_id: null,
    position_x: null,
    position_y: null,
    position_z: null,
    lore: null,
    properties: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getNutritionValue', () => {
  it('returns base value for known food at standard quality', () => {
    expect(getNutritionValue(fakeItem({ name: 'Wild mushroom' }))).toBe(35);
    expect(getNutritionValue(fakeItem({ name: 'Berries' }))).toBe(40);
    expect(getNutritionValue(fakeItem({ name: 'Plump helmet' }))).toBe(40);
    expect(getNutritionValue(fakeItem({ name: 'Dried meat' }))).toBe(50);
    expect(getNutritionValue(fakeItem({ name: 'Cured meat' }))).toBe(55);
    expect(getNutritionValue(fakeItem({ name: 'Prepared meal' }))).toBe(75);
  });

  it('falls back to FOOD_RESTORE_AMOUNT for unknown food names', () => {
    expect(getNutritionValue(fakeItem({ name: 'Mystery stew' }))).toBe(FOOD_RESTORE_AMOUNT);
  });

  it('applies quality multipliers', () => {
    // Prepared meal (75) * garbage (0.5) = 37.5 → 38
    expect(getNutritionValue(fakeItem({ name: 'Prepared meal', quality: 'garbage' }))).toBe(38);
    // Prepared meal (75) * masterwork (1.5) = 112.5 → capped at MAX_NEED (100)
    expect(getNutritionValue(fakeItem({ name: 'Prepared meal', quality: 'masterwork' }))).toBe(MAX_NEED);
    // Dried meat (50) * masterwork (1.5) = 75
    expect(getNutritionValue(fakeItem({ name: 'Dried meat', quality: 'masterwork' }))).toBe(75);
    // Dried meat (50) * poor (0.75) = 37.5 → 38
    expect(getNutritionValue(fakeItem({ name: 'Dried meat', quality: 'poor' }))).toBe(38);
    // Dried meat (50) * fine (1.1) = 55
    expect(getNutritionValue(fakeItem({ name: 'Dried meat', quality: 'fine' }))).toBe(55);
  });

  it('caps at MAX_NEED', () => {
    // Prepared meal (75) * artifact (2.0) = 150 → capped at MAX_NEED (100)
    const value = getNutritionValue(fakeItem({ name: 'Prepared meal', quality: 'artifact' }));
    expect(value).toBe(MAX_NEED);
  });
});

describe('getHydrationValue', () => {
  it('returns base value for known drinks at standard quality', () => {
    expect(getHydrationValue(fakeItem({ name: 'Plump helmet brew', category: 'drink' }))).toBe(65);
    expect(getHydrationValue(fakeItem({ name: 'Dwarven ale', category: 'drink' }))).toBe(80);
  });

  it('falls back to DRINK_RESTORE_AMOUNT for unknown drink names', () => {
    expect(getHydrationValue(fakeItem({ name: 'Well water', category: 'drink' }))).toBe(DRINK_RESTORE_AMOUNT);
  });

  it('applies quality multipliers', () => {
    // Dwarven ale (80) * poor (0.75) = 60
    expect(getHydrationValue(fakeItem({ name: 'Dwarven ale', quality: 'poor' }))).toBe(60);
    // Plump helmet brew (65) * exceptional (1.3) = 84.5 → 85
    expect(getHydrationValue(fakeItem({ name: 'Plump helmet brew', quality: 'exceptional' }))).toBe(85);
  });

  it('caps at MAX_NEED', () => {
    // Dwarven ale (80) * artifact (2.0) = 160 → capped at MAX_NEED (100)
    const value = getHydrationValue(fakeItem({ name: 'Dwarven ale', quality: 'artifact' }));
    expect(value).toBe(MAX_NEED);
  });
});
