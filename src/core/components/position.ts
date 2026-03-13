import { MAX_ENTITIES } from '@core/constants'

/**
 * Float world position. Use for smooth movement and interpolation.
 * For grid-snapped tile coordinates, use TileCoord instead.
 */
export const Position = {
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
  z: new Int16Array(MAX_ENTITIES),   // z-level (integer; 0 = surface, negative = underground)
}
