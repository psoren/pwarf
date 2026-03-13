import { describe, it, expect } from 'vitest'
import { generateHeightmap } from '@map/generators/heightmap'
import { generateBiomes } from '@map/generators/biomes'
import { generateRivers } from '@map/generators/rivers'
import { generateUnderground } from '@map/generators/underground'
import { buildWorld } from '@map/generators/worldSliceBuilder'
import { getTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'

describe('buildWorld', () => {
  const seed = 12345
  const W = 64
  const H = 64
  const D = 8

  function build() {
    const hm = generateHeightmap(seed, W, H)
    const biomes = generateBiomes(hm, seed, W, H)
    const rivers = generateRivers(hm, seed, W, H)
    const underground = generateUnderground(hm, seed, W, H, D)
    return buildWorld(hm, biomes, rivers, underground, W, H, D)
  }

  it('built world has correct dimensions', () => {
    const world = build()
    expect(world.width).toBe(W)
    expect(world.height).toBe(H)
    expect(world.depth).toBe(D)
  })

  it('surface z=0 has varied tiles (not all Stone)', () => {
    const world = build()
    const types = new Set<TileType>()
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        types.add(getTile(x, y, 0, world))
      }
    }
    expect(types.size).toBeGreaterThanOrEqual(2)
  })

  it('underground has Stone tiles below surface', () => {
    const world = build()
    let foundStone = false
    outer: for (let z = 1; z < D - 1; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (getTile(x, y, z, world) === TileType.Stone) {
            foundStone = true
            break outer
          }
        }
      }
    }
    expect(foundStone).toBe(true)
  })

  it('deepest layer (z=D-1) has Magma tiles', () => {
    const world = build()
    const deepZ = D - 1
    let foundMagma = false
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (getTile(x, y, deepZ, world) === TileType.Magma) {
          foundMagma = true
          break
        }
      }
    }
    expect(foundMagma).toBe(true)
  })
})
