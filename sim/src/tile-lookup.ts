import { FORTRESS_SIZE } from "@pwarf/shared";
import type { TileLookup } from "./pathfinding.js";
import type { SimContext } from "./sim-context.js";

/** Build a TileLookup that checks overrides first, then falls back to the deriver. */
export function buildTileLookup(ctx: SimContext): TileLookup {
  const { fortressDeriver } = ctx;
  const { fortressTileOverrides } = ctx.state;

  return (x: number, y: number, z: number) => {
    if (x < 0 || x >= FORTRESS_SIZE || y < 0 || y >= FORTRESS_SIZE) return null;

    // Check overrides first (mined/built tiles)
    const override = fortressTileOverrides.get(`${x},${y},${z}`);
    if (override) return override.tile_type;

    // Fall back to deterministic deriver
    if (fortressDeriver) {
      return fortressDeriver.deriveTile(x, y, z).tileType;
    }

    // No deriver available — treat as open_air (legacy fallback)
    return 'open_air';
  };
}
