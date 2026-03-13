import type { World3D } from '@map/world3d'
import { createWorld3D, setTile, setMaterial, setFlags } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { resolveSurfaceTile, resolveUndergroundTile } from '@map/generators/tileTypeResolver'
import type { RiverData } from '@map/generators/rivers'
import type { UndergroundData } from '@map/generators/underground'
import { BiomeType } from '@map/biomes'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH } from '@core/constants'

/** Bit flags for tile flags byte */
const FLAG_SKY_EXPOSED = 0b00000001
const FLAG_RIVER       = 0b00000010

function ugIndex(x: number, y: number, storageZ: number, width: number, height: number): number {
  return (storageZ - 1) * width * height + y * width + x
}

/**
 * Assemble a complete World3D from generator outputs.
 */
export function buildWorld(
  heightmap: Float32Array,
  biomes: Uint8Array,
  rivers: RiverData,
  underground: UndergroundData,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
  depth: number = WORLD_DEPTH,
): World3D {
  const world = createWorld3D(width, height, depth)

  // --- Surface (storageZ = 0) ---
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const surfIdx = y * width + x
      const elevation = heightmap[surfIdx] ?? 0
      const biome = (biomes[surfIdx] ?? BiomeType.Grassland) as BiomeType
      const isRiver = (rivers.isRiver[surfIdx] ?? 0) === 1

      const tile = resolveSurfaceTile(elevation, biome, isRiver)
      setTile(x, y, 0, world, tile)

      let flags = FLAG_SKY_EXPOSED
      if (isRiver) flags |= FLAG_RIVER
      setFlags(x, y, 0, world, flags)
    }
  }

  // --- Underground (storageZ = 1..depth-1) ---
  const deepestZ = depth - 1
  for (let storageZ = 1; storageZ < depth; storageZ++) {
    const isDeepest = storageZ === deepestZ
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ugIdx = ugIndex(x, y, storageZ, width, height)
        const isCavern  = (underground.isCavern[ugIdx] ?? 0) === 1
        const oreTypeVal = underground.oreType[ugIdx] ?? 0
        const stoneVal   = underground.stoneType[ugIdx] ?? 0

        // Deepest layer is always Magma regardless of depth constant
        const tile = isDeepest
          ? TileType.Magma
          : resolveUndergroundTile(storageZ, isCavern, oreTypeVal)
        setTile(x, y, storageZ, world, tile)

        // Set material for stone or ore tiles
        if (tile === TileType.Stone || tile === TileType.Ore) {
          setMaterial(x, y, storageZ, world, oreTypeVal !== 0 ? oreTypeVal : stoneVal)
        }
      }
    }
  }

  return world
}
