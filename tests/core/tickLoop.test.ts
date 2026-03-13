import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGameWorld } from '@core/world'
import { createTickLoop } from '@core/tickLoop'
import type { SystemFn } from '@core/types'
import type { GameWorld } from '@core/world'

describe('createTickLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls systems in registration order each tick', () => {
    const world = createGameWorld()
    const callOrder: number[] = []

    const sysA: SystemFn = (_w: GameWorld, _dt: number): void => { callOrder.push(1) }
    const sysB: SystemFn = (_w: GameWorld, _dt: number): void => { callOrder.push(2) }
    const sysC: SystemFn = (_w: GameWorld, _dt: number): void => { callOrder.push(3) }

    const loop = createTickLoop(world, [sysA, sysB, sysC], 20)
    loop.start()

    vi.advanceTimersByTime(50) // 1 tick at 20 tps = 50 ms

    expect(callOrder).toEqual([1, 2, 3])
  })

  it('passes the correct dt to systems', () => {
    const world = createGameWorld()
    const receivedDts: number[] = []

    const sys: SystemFn = (_w: GameWorld, dt: number): void => { receivedDts.push(dt) }

    const loop = createTickLoop(world, [sys], 20)
    loop.start()

    vi.advanceTimersByTime(50) // one tick

    expect(receivedDts).toHaveLength(1)
    expect(receivedDts[0]).toBeCloseTo(1 / 20)
  })

  it('uses a default of 20 ticks per second', () => {
    const world = createGameWorld()
    let callCount = 0

    const sys: SystemFn = (): void => { callCount++ }

    const loop = createTickLoop(world, [sys]) // no ticksPerSecond arg
    loop.start()

    vi.advanceTimersByTime(1000) // 1 second → 20 ticks

    expect(callCount).toBe(20)
  })

  it('increments tick count correctly', () => {
    const world = createGameWorld()
    const loop = createTickLoop(world, [], 20)
    loop.start()

    vi.advanceTimersByTime(150) // 3 ticks at 20 tps

    expect(loop.tick).toBe(3)
  })

  it('accumulates elapsed time correctly', () => {
    const world = createGameWorld()
    const loop = createTickLoop(world, [], 20)
    loop.start()

    vi.advanceTimersByTime(200) // 4 ticks → 0.2 s

    expect(loop.elapsed).toBeCloseTo(4 / 20)
  })

  it('stop() halts the loop — no further system calls after stop', () => {
    const world = createGameWorld()
    let callCount = 0

    const sys: SystemFn = (): void => { callCount++ }

    const loop = createTickLoop(world, [sys], 20)
    loop.start()

    vi.advanceTimersByTime(100) // 2 ticks
    loop.stop()
    vi.advanceTimersByTime(500) // would be 10 more ticks if running

    expect(callCount).toBe(2)
  })

  it('stop() does not change tick or elapsed after halting', () => {
    const world = createGameWorld()
    const loop = createTickLoop(world, [], 20)
    loop.start()

    vi.advanceTimersByTime(100) // 2 ticks
    loop.stop()

    const tickAfterStop = loop.tick
    const elapsedAfterStop = loop.elapsed

    vi.advanceTimersByTime(1000)

    expect(loop.tick).toBe(tickAfterStop)
    expect(loop.elapsed).toBe(elapsedAfterStop)
  })

  it('start() is a no-op when already running', () => {
    const world = createGameWorld()
    let callCount = 0

    const sys: SystemFn = (): void => { callCount++ }

    const loop = createTickLoop(world, [sys], 20)
    loop.start()
    loop.start() // second call — should not register a second interval

    vi.advanceTimersByTime(1000) // 1 second

    // If two intervals were registered this would be ~40; it should be 20.
    expect(callCount).toBe(20)
  })

  it('stop() is a no-op when already stopped', () => {
    const world = createGameWorld()
    const loop = createTickLoop(world, [], 20)

    // Should not throw when never started
    expect(() => loop.stop()).not.toThrow()

    loop.start()
    loop.stop()

    // Second stop should also not throw
    expect(() => loop.stop()).not.toThrow()
  })

  it('passes the world instance to each system', () => {
    const world = createGameWorld()
    const receivedWorlds: GameWorld[] = []

    const sys: SystemFn = (w: GameWorld): void => { receivedWorlds.push(w) }

    const loop = createTickLoop(world, [sys], 20)
    loop.start()

    vi.advanceTimersByTime(50) // one tick

    expect(receivedWorlds).toHaveLength(1)
    expect(receivedWorlds[0]).toBe(world)
  })

  it('tick and elapsed start at zero before any ticks', () => {
    const world = createGameWorld()
    const loop = createTickLoop(world, [], 20)

    expect(loop.tick).toBe(0)
    expect(loop.elapsed).toBe(0)
  })

  it('supports a custom ticksPerSecond', () => {
    const world = createGameWorld()
    let callCount = 0

    const sys: SystemFn = (): void => { callCount++ }

    const loop = createTickLoop(world, [sys], 10) // 10 tps
    loop.start()

    vi.advanceTimersByTime(1000) // 1 second → 10 ticks

    expect(callCount).toBe(10)
  })
})
