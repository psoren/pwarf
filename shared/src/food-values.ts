import { FOOD_RESTORE_AMOUNT, DRINK_RESTORE_AMOUNT, FOOD_NUTRITION, DRINK_HYDRATION, QUALITY_RESTORE_MULTIPLIERS, MAX_NEED } from './constants.js';
import type { Item } from './db-types.js';

/** Get the nutrition value for a food item, accounting for name and quality. */
export function getNutritionValue(item: Item): number {
  const base = FOOD_NUTRITION[item.name] ?? FOOD_RESTORE_AMOUNT;
  const multiplier = QUALITY_RESTORE_MULTIPLIERS[item.quality] ?? 1.0;
  return Math.min(MAX_NEED, Math.round(base * multiplier));
}

/** Get the hydration value for a drink item, accounting for name and quality. */
export function getHydrationValue(item: Item): number {
  const base = DRINK_HYDRATION[item.name] ?? DRINK_RESTORE_AMOUNT;
  const multiplier = QUALITY_RESTORE_MULTIPLIERS[item.quality] ?? 1.0;
  return Math.min(MAX_NEED, Math.round(base * multiplier));
}
