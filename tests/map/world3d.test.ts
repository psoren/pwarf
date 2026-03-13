import { describe, it, expect } from 'vitest'
import { createWorld3D, tileIndex, getTile, setTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'

describe('createWorld3D', () => {
  it('creates a world with default dimensions', () => {
    const w = createWorld3D()
    expect(w.width).toBe(128)
    expect(w.height).toBe(128)
    expect(w.depth).toBe(16)
  })

  it('creates typed arrays with correct size', () => {
    const w = createWorld3D(4, 4, 2)
    const expectedSize = 4 * 4 * 2
    expect(w.tiles.length).toBe(expectedSize)
    expect(w.materials.length).toBe(expectedSize)
    expect(w.flags.length).toBe(expectedSize)
  })

  it('initialises all tiles to Air (0)', () => {
    const w = createWorld3D(4, 4, 2)
    expect(w.tiles.every(v => v === TileType.Air)).toBe(true)
  })

  it('accepts custom dimensions', () => {
    const w = createWorld3D(10, 20, 5)
    expect(w.width).toBe(10)
    expect(w.height).toBe(20)
    expect(w.depth).toBe(5)
  })
})

describe('tileIndex', () => {
  it('returns 0 for origin (0,0,0)', () => {
    const w = createWorld3D(4, 4, 2)
    expect(tileIndex(0, 0, 0, w)).toBe(0)
  })

  it('increments by 1 for adjacent x', () => {
    const w = createWorld3D(4, 4, 2)
    expect(tileIndex(1, 0, 0, w)).toBe(1)
    expect(tileIndex(2, 0, 0, w)).toBe(2)
  })

  it('increments by width for adjacent y', () => {
    const w = createWorld3D(4, 4, 2)
    expect(tileIndex(0, 1, 0, w)).toBe(4)
    expect(tileIndex(0, 2, 0, w)).toBe(8)
  })

  it('increments by width*height for adjacent z', () => {
    const w = createWorld3D(4, 4, 2)
    expect(tileIndex(0, 0, 1, w)).toBe(16)
  })

  it('computes compound index correctly', () => {
    const w = createWorld3D(4, 4, 2)
    // z=1, y=2, x=3 → 1*16 + 2*4 + 3 = 27
    expect(tileIndex(3, 2, 1, w)).toBe(27)
  })
})

describe('getTile', () => {
  it('returns Air for an untouched cell', () => {
    const w = createWorld3D(4, 4, 2)
    expect(getTile(1, 1, 0, w)).toBe(TileType.Air)
  })

  it('returns Air for negative x (out-of-bounds)', () => {
    const w = createWorld3D(4, 4, 2)
    expect(getTile(-1, 0, 0, w)).toBe(TileType.Air)
  })

  it('returns Air for x >= width (out-of-bounds)', () => {
    const w = createWorld3D(4, 4, 2)
    expect(getTile(4, 0, 0, w)).toBe(TileType.Air)
  })

  it('returns Air for y out-of-bounds', () => {
    const w = createWorld3D(4, 4, 2)
    expect(getTile(0, -1, 0, w)).toBe(TileType.Air)
    expect(getTile(0, 4, 0, w)).toBe(TileType.Air)
  })

  it('returns Air for z out-of-bounds', () => {
    const w = createWorld3D(4, 4, 2)
    expect(getTile(0, 0, -1, w)).toBe(TileType.Air)
    expect(getTile(0, 0, 2, w)).toBe(TileType.Air)
  })

  it('returns the tile type after setTile', () => {
    const w = createWorld3D(4, 4, 2)
    setTile(2, 3, 1, w, TileType.Stone)
    expect(getTile(2, 3, 1, w)).toBe(TileType.Stone)
  })
})

describe('setTile', () => {
  it('sets a tile and the value is readable via getTile', () => {
    const w = createWorld3D(4, 4, 2)
    setTile(0, 0, 0, w, TileType.Wall)
    expect(getTile(0, 0, 0, w)).toBe(TileType.Wall)
  })

  it('does not throw for out-of-bounds coordinates', () => {
    const w = createWorld3D(4, 4, 2)
    expect(() => setTile(-1, 0, 0, w, TileType.Stone)).not.toThrow()
    expect(() => setTile(0, 0, 99, w, TileType.Stone)).not.toThrow()
  })

  it('does not mutate the array for out-of-bounds writes', () => {
    const w = createWorld3D(4, 4, 2)
    setTile(99, 99, 99, w, TileType.Stone)
    expect(w.tiles.every(v => v === TileType.Air)).toBe(true)
  })

  it('sets all TileType variants correctly', () => {
    const w = createWorld3D(4, 4, 2)
    const types: TileType[] = [
      TileType.Air,
      TileType.Stone,
      TileType.Soil,
      TileType.Water,
      TileType.Floor,
      TileType.Wall,
    ]
    for (const type of types) {
      setTile(0, 0, 0, w, type)
      expect(getTile(0, 0, 0, w)).toBe(type)
    }
  })

  it('sets tiles independently across different cells', () => {
    const w = createWorld3D(4, 4, 2)
    setTile(0, 0, 0, w, TileType.Stone)
    setTile(1, 0, 0, w, TileType.Soil)
    setTile(0, 1, 0, w, TileType.Water)
    expect(getTile(0, 0, 0, w)).toBe(TileType.Stone)
    expect(getTile(1, 0, 0, w)).toBe(TileType.Soil)
    expect(getTile(0, 1, 0, w)).toBe(TileType.Water)
  })
})
