import {
  FOOD_RESTORE_AMOUNT,
  DRINK_RESTORE_AMOUNT,
  FOOD_NUTRITION,
  DRINK_HYDRATION,
  QUALITY_NUTRITION_MULTIPLIER,
} from "@pwarf/shared";
import type { Item } from "@pwarf/shared";

/**
 * Get the nutrition value for a food item.
 * Checks item.properties.nutrition_value first, then FOOD_NUTRITION by name,
 * then falls back to FOOD_RESTORE_AMOUNT. Applies quality multiplier.
 */
export function getNutritionValue(item: Item): number {
  const base = typeof item.properties?.nutrition_value === 'number'
    ? item.properties.nutrition_value
    : FOOD_NUTRITION[item.name] ?? FOOD_RESTORE_AMOUNT;

  const qualityMul = QUALITY_NUTRITION_MULTIPLIER[item.quality] ?? 1.0;
  return Math.round(base * qualityMul);
}

/**
 * Get the hydration value for a drink item.
 * Checks item.properties.hydration_value first, then DRINK_HYDRATION by name,
 * then falls back to DRINK_RESTORE_AMOUNT. Applies quality multiplier.
 */
export function getHydrationValue(item: Item): number {
  const base = typeof item.properties?.hydration_value === 'number'
    ? item.properties.hydration_value
    : DRINK_HYDRATION[item.name] ?? DRINK_RESTORE_AMOUNT;

  const qualityMul = QUALITY_NUTRITION_MULTIPLIER[item.quality] ?? 1.0;
  return Math.round(base * qualityMul);
}
