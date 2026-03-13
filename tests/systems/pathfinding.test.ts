import { describe, it, expect } from 'vitest'
import { createWorld3D, setTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { findPath, isTilePassable } from '@systems/pathfinding'

function makeGrassMap(w: number, h: number) {
  const map = createWorld3D(w, h, 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setTile(x, y, 0, map, TileType.Grass)
    }
  }
  return map
}

describe('isTilePassable', () => {
  it('returns true for Air, Soil, Water, Floor, Grass, Sand, Snow', () => {
    expect(isTilePassable(TileType.Air)).toBe(true)
    expect(isTilePassable(TileType.Soil)).toBe(true)
    expect(isTilePassable(TileType.Water)).toBe(true)
    expect(isTilePassable(TileType.Floor)).toBe(true)
    expect(isTilePassable(TileType.Grass)).toBe(true)
    expect(isTilePassable(TileType.Sand)).toBe(true)
    expect(isTilePassable(TileType.Snow)).toBe(true)
  })

  it('returns false for Stone, Wall, Ice, Ore, Magma', () => {
    expect(isTilePassable(TileType.Stone)).toBe(false)
    expect(isTilePassable(TileType.Wall)).toBe(false)
    expect(isTilePassable(TileType.Ice)).toBe(false)
    expect(isTilePassable(TileType.Ore)).toBe(false)
    expect(isTilePassable(TileType.Magma)).toBe(false)
  })
})

describe('findPath', () => {
  it('returns [] when from === to', () => {
    const map = makeGrassMap(10, 10)
    const result = findPath(map, { x: 3, y: 3, z: 0 }, { x: 3, y: 3, z: 0 })
    expect(result).toEqual([])
  })

  it('finds a straight-line path', () => {
    const map = makeGrassMap(10, 10)
    const path = findPath(map, { x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 0 })
    expect(path).not.toBeNull()
    expect(path!.length).toBe(3)
    expect(path![0]).toEqual({ x: 1, y: 0, z: 0 })
    expect(path![2]).toEqual({ x: 3, y: 0, z: 0 })
  })

  it('finds a path around a wall', () => {
    const map = makeGrassMap(10, 10)
    // Place a vertical wall at x=3, y=0..4
    for (let y = 0; y < 5; y++) {
      setTile(3, y, 0, map, TileType.Stone)
    }
    const path = findPath(map, { x: 0, y: 2, z: 0 }, { x: 6, y: 2, z: 0 })
    expect(path).not.toBeNull()
    expect(path!.length).toBeGreaterThan(4)
    // Path should end at destination
    expect(path![path!.length - 1]).toEqual({ x: 6, y: 2, z: 0 })
  })

  it('returns null when destination is completely enclosed by walls', () => {
    const map = makeGrassMap(10, 10)
    // Enclose destination (5,5) with walls
    setTile(4, 5, 0, map, TileType.Stone)
    setTile(6, 5, 0, map, TileType.Stone)
    setTile(5, 4, 0, map, TileType.Stone)
    setTile(5, 6, 0, map, TileType.Stone)
    setTile(5, 5, 0, map, TileType.Stone)
    const path = findPath(map, { x: 0, y: 0, z: 0 }, { x: 5, y: 5, z: 0 })
    expect(path).toBeNull()
  })

  it('path does not include start tile', () => {
    const map = makeGrassMap(10, 10)
    const path = findPath(map, { x: 1, y: 1, z: 0 }, { x: 4, y: 1, z: 0 })
    expect(path).not.toBeNull()
    // First step should not be the start tile
    expect(path![0]).not.toEqual({ x: 1, y: 1, z: 0 })
  })

  it('path includes destination tile', () => {
    const map = makeGrassMap(10, 10)
    const to = { x: 5, y: 5, z: 0 }
    const path = findPath(map, { x: 0, y: 0, z: 0 }, to)
    expect(path).not.toBeNull()
    const last = path![path!.length - 1]!
    expect(last.x).toBe(to.x)
    expect(last.y).toBe(to.y)
  })

  it('can path to a non-passable destination (e.g. mining adjacent)', () => {
    const map = makeGrassMap(10, 10)
    setTile(5, 0, 0, map, TileType.Stone)
    // Path to stone tile from (0,0) — should succeed since destination check is relaxed
    const path = findPath(map, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 })
    expect(path).not.toBeNull()
  })

  it('performance: pathfinds a 100x100 map in reasonable time', () => {
    const map = makeGrassMap(100, 100)
    const start = performance.now()
    const path = findPath(map, { x: 0, y: 0, z: 0 }, { x: 99, y: 99, z: 0 })
    const elapsed = performance.now() - start
    expect(path).not.toBeNull()
    expect(elapsed).toBeLessThan(500)  // under 500ms
  })
})
