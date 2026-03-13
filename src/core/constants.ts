// World dimensions
export const WORLD_WIDTH = 128
export const WORLD_HEIGHT = 128
export const WORLD_DEPTH = 16   // z-levels: 0 = surface, negative = underground

// ECS sizing — max entities allocated in typed arrays
export const MAX_ENTITIES = 10_000

// Rendering
export const TILE_SIZE = 16     // pixels per tile

// Tick loop
export const TICKS_PER_SECOND = 20

// Needs decay rates (per tick)
export const HUNGER_DECAY_RATE = 0.00005
export const THIRST_DECAY_RATE = 0.0001
export const SLEEP_DECAY_RATE  = 0.000025
export const NEEDS_CRITICAL_THRESHOLD = 0.25

// Sleep restore rate (per tick)
export const SLEEP_RESTORE_RATE = 0.002

// Mining ticks to complete one tile
export const MINING_TICKS = 50
