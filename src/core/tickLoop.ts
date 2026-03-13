import type { GameWorld } from '@core/world'
import type { SystemFn } from '@core/types'

const DEFAULT_TICKS_PER_SECOND = 20

/**
 * A running tick loop returned by `createTickLoop`.
 */
export type TickLoop = {
  /** Start ticking. No-op if already running. */
  start: () => void
  /** Stop ticking. No-op if already stopped. */
  stop: () => void
  /** Total number of ticks that have been executed. */
  readonly tick: number
  /** Total elapsed game time in seconds (tick * dt). */
  readonly elapsed: number
}

/**
 * Creates a fixed-timestep game loop that calls each registered system
 * once per tick in the order they are provided.
 *
 * Uses `setInterval` so it works headlessly (no `requestAnimationFrame`).
 *
 * @param world          - The ECS world passed to every system each tick.
 * @param systems        - Ordered array of system functions to invoke per tick.
 * @param ticksPerSecond - How many ticks to run per second (default: 20).
 */
export function createTickLoop(
  world: GameWorld,
  systems: SystemFn[],
  ticksPerSecond: number = DEFAULT_TICKS_PER_SECOND,
): TickLoop {
  const dt = 1 / ticksPerSecond

  let tickCount = 0
  let elapsedTime = 0
  let intervalId: ReturnType<typeof setInterval> | null = null

  function runTick(): void {
    for (let i = 0; i < systems.length; i++) {
      systems[i]!(world, dt)
    }
    tickCount += 1
    elapsedTime += dt
  }

  const loop: TickLoop = {
    start(): void {
      if (intervalId !== null) return
      intervalId = setInterval(runTick, (1 / ticksPerSecond) * 1000)
    },

    stop(): void {
      if (intervalId === null) return
      clearInterval(intervalId)
      intervalId = null
    },

    get tick(): number {
      return tickCount
    },

    get elapsed(): number {
      return elapsedTime
    },
  }

  return loop
}
