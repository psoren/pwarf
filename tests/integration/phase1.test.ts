import { describe, it, expect } from 'vitest'
import { generateWorld } from '@map/generators/worldGenOrchestrator'
import { TileType } from '@map/tileTypes'
import { getTile } from '@map/world3d'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH } from '@core/constants'

describe('Phase 1 integration', () => {
  it('generates a world in < 10 seconds with seed 12345', async () => {
    const events: Array<{ p: number; label: string }> = []
    const world = await generateWorld(
      12345,
      WORLD_WIDTH,
      WORLD_HEIGHT,
      WORLD_DEPTH,
      (p, label) => { events.push({ p, label }) },
    )

    // Correct dimensions
    expect(world.width).toBe(WORLD_WIDTH)
    expect(world.height).toBe(WORLD_HEIGHT)

    // Surface (z=0) has at least 3 distinct tile types
    const surfaceTiles = new Set<TileType>()
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        surfaceTiles.add(getTile(x, y, 0, world))
      }
    }
    expect(surfaceTiles.size).toBeGreaterThanOrEqual(3)

    // At least one Water tile on surface
    expect(surfaceTiles.has(TileType.Water)).toBe(true)

    // Underground has Stone tiles
    let hasStone = false
    outer: for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (getTile(x, y, 4, world) === TileType.Stone) {
          hasStone = true
          break outer
        }
      }
    }
    expect(hasStone).toBe(true)

    // Progress events fired in order 0 → 1
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]!.p).toBe(0.0)
    expect(events[events.length - 1]!.p).toBe(1.0)
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.p).toBeGreaterThanOrEqual(events[i - 1]!.p)
    }
  }, 10_000)

  it('same seed produces identical surface tiles', async () => {
    const w1 = await generateWorld(42)
    const w2 = await generateWorld(42)
    for (let i = 0; i < Math.min(100, w1.tiles.length); i++) {
      expect(w1.tiles[i]).toBe(w2.tiles[i])
    }
  }, 20_000)
})
