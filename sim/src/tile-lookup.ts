import { FORTRESS_SIZE } from "@pwarf/shared";
import type { FortressTileType, FortressDeriver } from "@pwarf/shared";
import type { TileLookup } from "./pathfinding.js";
import type { SimContext } from "./sim-context.js";

/**
 * Per-deriver cache for derived tile results. Since deriveTile is deterministic
 * (based on the world seed), the cache is shared across all buildTileLookup calls
 * for the same deriver instance and never needs invalidation. Using a WeakMap
 * ensures the cache is garbage-collected when the deriver is released.
 */
const derivedCacheByDeriver = new WeakMap<FortressDeriver, Map<string, FortressTileType>>();

/** Build a TileLookup that checks overrides first, then falls back to the deriver. */
export function buildTileLookup(ctx: SimContext): TileLookup {
  const { fortressDeriver } = ctx;
  const { fortressTileOverrides } = ctx.state;

  // Get or create the cache for this deriver instance
  let derivedCache: Map<string, FortressTileType> | undefined;
  if (fortressDeriver) {
    derivedCache = derivedCacheByDeriver.get(fortressDeriver);
    if (!derivedCache) {
      derivedCache = new Map();
      derivedCacheByDeriver.set(fortressDeriver, derivedCache);
    }
  }

  return (x: number, y: number, z: number) => {
    if (x < 0 || x >= FORTRESS_SIZE || y < 0 || y >= FORTRESS_SIZE) return null;

    // Check overrides first (mined/built tiles)
    const override = fortressTileOverrides.get(`${x},${y},${z}`);
    if (override) return override.tile_type;

    // Fall back to deterministic deriver (cached across all lookups)
    if (fortressDeriver && derivedCache) {
      const key = `${x},${y},${z}`;
      const cached = derivedCache.get(key);
      if (cached !== undefined) return cached;
      const tile = fortressDeriver.deriveTile(x, y, z).tileType;
      derivedCache.set(key, tile);
      return tile;
    }

    // No deriver available — treat as open_air (legacy fallback)
    return 'open_air';
  };
}
