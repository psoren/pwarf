import { describe, it, expect } from 'vitest';
import { getNutritionValue, getHydrationValue } from './nutrition.js';
import { makeItem } from './__tests__/test-helpers.js';
import { FOOD_RESTORE_AMOUNT, DRINK_RESTORE_AMOUNT } from '@pwarf/shared';

describe('getNutritionValue', () => {
  it('returns properties.nutrition_value when set', () => {
    const item = makeItem({ name: 'Custom food', properties: { nutrition_value: 42 } });
    expect(getNutritionValue(item)).toBe(42);
  });

  it('falls back to FOOD_NUTRITION by name', () => {
    const item = makeItem({ name: 'Prepared meal', properties: {} });
    expect(getNutritionValue(item)).toBe(75); // FOOD_NUTRITION['Prepared meal']
  });

  it('falls back to FOOD_RESTORE_AMOUNT for unknown names', () => {
    const item = makeItem({ name: 'Unknown grub', properties: {} });
    expect(getNutritionValue(item)).toBe(FOOD_RESTORE_AMOUNT);
  });

  it('applies quality multiplier', () => {
    const standard = makeItem({ name: 'Wild mushroom', quality: 'standard', properties: {} });
    const masterwork = makeItem({ name: 'Wild mushroom', quality: 'masterwork', properties: {} });
    expect(getNutritionValue(masterwork)).toBeGreaterThan(getNutritionValue(standard));
    // masterwork = 35 * 1.5 = 52.5 → 53
    expect(getNutritionValue(masterwork)).toBe(53);
  });

  it('raw foraged food restores less than cooked meals', () => {
    const raw = makeItem({ name: 'Wild mushroom', properties: {} });
    const cooked = makeItem({ name: 'Prepared meal', quality: 'fine', properties: {} });
    expect(getNutritionValue(cooked)).toBeGreaterThan(getNutritionValue(raw));
  });
});

describe('getHydrationValue', () => {
  it('returns properties.hydration_value when set', () => {
    const item = makeItem({ category: 'drink', name: 'Custom drink', properties: { hydration_value: 55 } });
    expect(getHydrationValue(item)).toBe(55);
  });

  it('falls back to DRINK_HYDRATION by name', () => {
    const item = makeItem({ category: 'drink', name: 'Plump helmet brew', properties: {} });
    expect(getHydrationValue(item)).toBe(70);
  });

  it('falls back to DRINK_RESTORE_AMOUNT for unknown names', () => {
    const item = makeItem({ category: 'drink', name: 'Mystery liquid', properties: {} });
    expect(getHydrationValue(item)).toBe(DRINK_RESTORE_AMOUNT);
  });

  it('applies quality multiplier', () => {
    const standard = makeItem({ category: 'drink', name: 'Plump helmet brew', quality: 'standard', properties: {} });
    const masterwork = makeItem({ category: 'drink', name: 'Plump helmet brew', quality: 'masterwork', properties: {} });
    expect(getHydrationValue(masterwork)).toBeGreaterThan(getHydrationValue(standard));
  });
});
