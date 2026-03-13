import { MAX_ENTITIES } from '@core/constants'

/**
 * A permanent tile-based resource patch (mushroom cluster, spring, etc.)
 * that periodically spawns a food or drink item at its location.
 */
export const Patch = {
  x:        new Int32Array(MAX_ENTITIES),
  y:        new Int32Array(MAX_ENTITIES),
  z:        new Int16Array(MAX_ENTITIES),
  itemType: new Uint8Array(MAX_ENTITIES),   // ItemType.Food or ItemType.Drink
  timer:    new Int32Array(MAX_ENTITIES),    // ticks until next spawn
  interval: new Int32Array(MAX_ENTITIES),   // ticks between spawns
}
