import type { FortressTile } from "@pwarf/shared";

/** Returns true if two override maps have the same keys and tile_type/is_mined/material values. */
export function overridesEqual(
  a: Map<string, Partial<FortressTile>>,
  b: Map<string, Partial<FortressTile>>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of b) {
    const old = a.get(k);
    if (!old || old.tile_type !== v.tile_type || old.is_mined !== v.is_mined || old.material !== v.material) {
      return false;
    }
  }
  return true;
}
