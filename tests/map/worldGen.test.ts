import { describe, it, expect } from 'vitest'
import { generateWorld } from '@map/generators/worldGenOrchestrator'
import { getTile } from '@map/world3d'

describe('generateWorld (orchestrator)', () => {
  it('returns World3D with correct dimensions', async () => {
    const world = await generateWorld(1, 32, 32, 8)
    expect(world.width).toBe(32)
    expect(world.height).toBe(32)
    expect(world.depth).toBe(8)
  }, 15_000)

  it('same seed produces identical tiles at spot-checked positions', async () => {
    const w1 = await generateWorld(42, 64, 64, 8)
    const w2 = await generateWorld(42, 64, 64, 8)

    // Check 10 spot positions
    const spots = [
      [10, 10, 0], [20, 30, 0], [5, 5, 1], [40, 40, 2],
      [63, 63, 0], [0, 0, 0], [32, 32, 3], [15, 15, 0],
      [50, 25, 1], [25, 50, 2],
    ] as Array<[number, number, number]>

    for (const [x, y, z] of spots) {
      expect(getTile(x, y, z, w1)).toBe(getTile(x, y, z, w2))
    }
  }, 30_000)

  it('different seeds produce different results', async () => {
    const w1 = await generateWorld(100, 32, 32, 8)
    const w2 = await generateWorld(200, 32, 32, 8)
    let differs = false
    for (let i = 0; i < Math.min(100, w1.tiles.length); i++) {
      if (w1.tiles[i] !== w2.tiles[i]) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  }, 30_000)

  it('progress events fire in increasing order from 0 to 1', async () => {
    const events: number[] = []
    await generateWorld(1, 32, 32, 8, (p) => events.push(p))
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toBe(0.0)
    expect(events[events.length - 1]).toBe(1.0)
    for (let i = 1; i < events.length; i++) {
      expect(events[i]! >= events[i - 1]!).toBe(true)
    }
  }, 15_000)
})
