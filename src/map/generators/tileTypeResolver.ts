import { TileType } from '@map/tileTypes'
import { BiomeType } from '@map/biomes'
import { OreMaterial } from '@map/materials'

/**
 * Determine the surface tile type based on elevation, biome, and river status.
 */
export function resolveSurfaceTile(
  elevation: number,
  biome: BiomeType,
  isRiver: boolean,
): TileType {
  if (isRiver || elevation < 0.35) return TileType.Water
  if (elevation >= 0.80) return TileType.Stone  // mountain peak
  switch (biome) {
    case BiomeType.Desert:  return TileType.Sand
    case BiomeType.Tundra:  return TileType.Snow
    case BiomeType.Ocean:   return TileType.Water
    default:                return TileType.Grass
  }
}

/**
 * Determine underground tile type based on depth, cavern status, and ore presence.
 * storageZ = 1 is just below the surface; storageZ = 15 is the deepest (magma).
 */
export function resolveUndergroundTile(
  storageZ: number,
  isCavern: boolean,
  oreType: OreMaterial,
): TileType {
  if (storageZ === 15) return TileType.Magma  // deepest layer
  if (isCavern)        return TileType.Air
  if (oreType !== OreMaterial.None) return TileType.Ore
  return TileType.Stone
}
