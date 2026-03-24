import type { TerrainType } from './db-types.js';

/** Base ticks per overworld tile of travel. ~90 ticks = 1/20th of a day. */
export const BASE_TRAVEL_TICKS_PER_TILE = 90;

/** Terrain-specific travel cost multipliers. */
export const TERRAIN_TRAVEL_COST: Record<TerrainType, number> = {
  plains: 1.0,
  forest: 1.3,
  desert: 1.5,
  tundra: 1.5,
  swamp: 1.8,
  mountain: 2.0,
  volcano: 3.0,
  ocean: Infinity,
  underground: 1.5,
  haunted: 1.5,
  savage: 1.5,
  evil: 1.5,
};

/** Maximum party size for an expedition. */
export const MAX_EXPEDITION_PARTY_SIZE = 3;

/** Fraction of ruin wealth extracted per loot unit. */
export const LOOT_PER_WEALTH_UNIT = 0.01;

/**
 * Calculate the total travel ticks for a given Manhattan distance and
 * destination terrain type.
 *
 * MVP simplification: uses destination terrain cost only (no pathfinding).
 */
export function calculateTravelTicks(distance: number, terrain: TerrainType): number {
  const cost = TERRAIN_TRAVEL_COST[terrain] ?? 1.0;
  return Math.ceil(distance * BASE_TRAVEL_TICKS_PER_TILE * cost);
}
