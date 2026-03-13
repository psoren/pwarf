import { describe, it, expect } from 'vitest'
import { resolveSurfaceTile, resolveUndergroundTile } from '@map/generators/tileTypeResolver'
import { TileType } from '@map/tileTypes'
import { BiomeType } from '@map/biomes'
import { OreMaterial } from '@map/materials'

describe('resolveSurfaceTile', () => {
  it('returns Water for river tiles', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Grassland, true)).toBe(TileType.Water)
  })

  it('returns Water for ocean elevation (< 0.35)', () => {
    expect(resolveSurfaceTile(0.2, BiomeType.Grassland, false)).toBe(TileType.Water)
    expect(resolveSurfaceTile(0.34, BiomeType.Forest, false)).toBe(TileType.Water)
  })

  it('returns Stone for mountain peaks (elevation >= 0.80)', () => {
    expect(resolveSurfaceTile(0.80, BiomeType.Forest, false)).toBe(TileType.Stone)
    expect(resolveSurfaceTile(0.95, BiomeType.Grassland, false)).toBe(TileType.Stone)
  })

  it('returns Sand for Desert biome', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Desert, false)).toBe(TileType.Sand)
  })

  it('returns Snow for Tundra biome', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Tundra, false)).toBe(TileType.Snow)
  })

  it('returns Water for Ocean biome', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Ocean, false)).toBe(TileType.Water)
  })

  it('returns Grass for Grassland biome', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Grassland, false)).toBe(TileType.Grass)
  })

  it('returns Grass for Forest biome (default)', () => {
    expect(resolveSurfaceTile(0.5, BiomeType.Forest, false)).toBe(TileType.Grass)
  })
})

describe('resolveUndergroundTile', () => {
  it('returns Magma at storageZ = 15', () => {
    expect(resolveUndergroundTile(15, false, OreMaterial.None)).toBe(TileType.Magma)
    expect(resolveUndergroundTile(15, true, OreMaterial.Coal)).toBe(TileType.Magma)
  })

  it('returns Air for cavern tiles', () => {
    expect(resolveUndergroundTile(7, true, OreMaterial.None)).toBe(TileType.Air)
  })

  it('returns Ore when oreType is set', () => {
    expect(resolveUndergroundTile(5, false, OreMaterial.Iron)).toBe(TileType.Ore)
    expect(resolveUndergroundTile(5, false, OreMaterial.Gold)).toBe(TileType.Ore)
  })

  it('returns Stone for solid non-ore tiles', () => {
    expect(resolveUndergroundTile(5, false, OreMaterial.None)).toBe(TileType.Stone)
    expect(resolveUndergroundTile(1, false, OreMaterial.None)).toBe(TileType.Stone)
  })
})
