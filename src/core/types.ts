import type { GameWorld } from '@core/world'

/**
 * A system function receives the ECS world and the elapsed time (in seconds)
 * since the last tick, and performs all of its mutations in-place.
 *
 * Systems are pure: no return value, no stored state, no browser APIs.
 */
export type SystemFn = (world: GameWorld, dt: number) => void

/**
 * Commands dispatched from player input (keyboard / mouse) to the command handler.
 */
export type GameCommand =
  | { type: 'MOVE_CAMERA'; dx: number; dy: number }
  | { type: 'CHANGE_Z'; dz: number }
  | { type: 'TILE_CLICK'; x: number; y: number; z: number }
  | { type: 'TILE_RIGHT_CLICK'; x: number; y: number; z: number }
  | { type: 'CANCEL' }

/**
 * Snapshot of a single dwarf's state, returned by HeadlessGame.getDwarves().
 */
export type DwarfStatus = {
  eid: number
  x: number
  y: number
  z: number
  hunger: number
  thirst: number
  sleep: number
  happiness: number
  job: string | null
}

/**
 * A count of a specific item type, returned by HeadlessGame.getStocks().
 */
export type ItemCount = {
  itemType: string
  count: number
}

/**
 * A snapshot of the full game state, returned by HeadlessGame.tick() and runFor().
 */
export type GameState = {
  tick: number
  dwarves: DwarfStatus[]
  stocks: ItemCount[]
}
