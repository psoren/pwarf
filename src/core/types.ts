import type { GameWorld } from '@core/world'

/**
 * A system function receives the ECS world and the elapsed time (in seconds)
 * since the last tick, and performs all of its mutations in-place.
 *
 * Systems are pure: no return value, no stored state, no browser APIs.
 */
export type SystemFn = (world: GameWorld, dt: number) => void
