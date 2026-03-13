import { MAX_ENTITIES } from '@core/constants'

/**
 * Float velocity in world units per second.
 * Only entities that are currently moving need this component.
 */
export const Velocity = {
  vx: new Float32Array(MAX_ENTITIES),
  vy: new Float32Array(MAX_ENTITIES),
}
