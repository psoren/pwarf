import { MAX_ENTITIES } from '@core/constants'

/**
 * Integer tile-grid position. This is the authoritative grid location used by
 * pathfinding, job targeting, and world queries. Distinct from Position which
 * holds the smooth float position for rendering interpolation.
 */
export const TileCoord = {
  x: new Int32Array(MAX_ENTITIES),
  y: new Int32Array(MAX_ENTITIES),
  z: new Int16Array(MAX_ENTITIES),
}
