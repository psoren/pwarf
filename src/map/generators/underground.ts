import { StoneMaterial, OreMaterial } from '@map/materials'
import { makePerm, fBm2d, mulberry32 } from '@map/biomes'
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_DEPTH } from '@core/constants'

export type UndergroundData = {
  /** StoneMaterial per underground tile, size = width * height * (depth - 1) */
  stoneType: Uint8Array
  /** OreMaterial per underground tile (0 = none) */
  oreType:   Uint8Array
  /** 1 = cavern (Air), 0 = solid */
  isCavern:  Uint8Array
}

/** Flat index for underground tile at (x, y, storageZ) where storageZ = 1..depth-1 */
function ugIndex(x: number, y: number, storageZ: number, width: number, height: number): number {
  // storageZ offset: storageZ=1 maps to layer 0
  return (storageZ - 1) * width * height + y * width + x
}

/**
 * Generate all underground layers (storageZ = 1..depth-1).
 * storageZ = 1 is just below the surface, storageZ = depth-1 is the deepest.
 */
export function generateUnderground(
  heightmap: Float32Array,
  seed: number,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
  depth: number = WORLD_DEPTH,
): UndergroundData {
  const layers = depth - 1
  const size = width * height * layers

  const stoneType = new Uint8Array(size)
  const oreType   = new Uint8Array(size)
  const isCavern  = new Uint8Array(size)

  // Perlin tables for each feature
  const stonePerm   = makePerm(seed ^ 0xABCDEF01)
  const cavernPerm  = makePerm(seed ^ 0x12345678)
  const coalPerm    = makePerm(seed ^ 0xFEDCBA98)
  const ironPerm    = makePerm(seed ^ 0x11223344)
  const copperPerm  = makePerm(seed ^ 0x55667788)
  const goldPerm    = makePerm(seed ^ 0x99AABBCC)
  const adamPerm    = makePerm(seed ^ 0xDDEEFF00)

  // Domain warp tables
  const warpPerm1   = makePerm(seed ^ 0xC0FFEE01)
  const warpPerm2   = makePerm(seed ^ 0xC0FFEE02)

  const rng = mulberry32(seed ^ 0x777ABCDE)
  // Ore thresholds — tuned so each ore has reasonable prevalence
  // fBm with 3 octaves returns values in roughly [0.25, 0.78], so threshold must be < 0.77
  const ORE_THRESHOLD = 0.68

  for (let storageZ = 1; storageZ < depth; storageZ++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = ugIndex(x, y, storageZ, width, height)

        // --- Stone type ---
        const stoneNoise = fBm2d(x / 32, y / 32, 3, 2.0, 0.5, stonePerm)
        if (stoneNoise < 0.20) stoneType[idx] = StoneMaterial.Granite
        else if (stoneNoise < 0.40) stoneType[idx] = StoneMaterial.Limestone
        else if (stoneNoise < 0.58) stoneType[idx] = StoneMaterial.Sandstone
        else if (stoneNoise < 0.76) stoneType[idx] = StoneMaterial.Basalt
        else stoneType[idx] = StoneMaterial.Marble

        // --- Caverns (deeper levels) ---
        if (storageZ >= 7) {
          const cavernNoise = fBm2d(
            x / 24 + storageZ * 0.1,
            y / 24 + storageZ * 0.1,
            4, 2.0, 0.5,
            cavernPerm,
          )
          if (cavernNoise > 0.62) {
            isCavern[idx] = 1
          }
        }

        // --- Ore veins using domain-warped noise ---
        // Domain warp: offset x/y by another noise field
        const warpX = fBm2d(x / 20, y / 20, 3, 2.0, 0.5, warpPerm1) * 2 - 1
        const warpY = fBm2d(x / 20 + 3.7, y / 20 + 1.3, 3, 2.0, 0.5, warpPerm2) * 2 - 1
        const wx = x / 16 + warpX * 0.4
        const wy = y / 16 + warpY * 0.4

        // Coal (storageZ 1-8)
        if (storageZ >= 1 && storageZ <= 8) {
          const v = fBm2d(wx, wy + storageZ * 0.3, 3, 2.0, 0.5, coalPerm)
          if (v > ORE_THRESHOLD) {
            oreType[idx] = OreMaterial.Coal
          }
        }

        // Iron (storageZ 1-8) — slightly rarer than coal
        if (storageZ >= 1 && storageZ <= 8) {
          const v = fBm2d(wx + 5.1, wy + storageZ * 0.3, 3, 2.0, 0.5, ironPerm)
          if (v > ORE_THRESHOLD + 0.02) {
            oreType[idx] = OreMaterial.Iron
          }
        }

        // Copper (storageZ 1-8)
        if (storageZ >= 1 && storageZ <= 8) {
          const v = fBm2d(wx + 2.3, wy + storageZ * 0.35, 3, 2.0, 0.5, copperPerm)
          if (v > ORE_THRESHOLD + 0.01) {
            oreType[idx] = OreMaterial.Copper
          }
        }

        // Gold (storageZ 4-14) — extended range so it appears more
        if (storageZ >= 4 && storageZ <= 14) {
          const v = fBm2d(wx + 7.7, wy + storageZ * 0.2, 3, 2.0, 0.5, goldPerm)
          if (v > ORE_THRESHOLD + 0.03) {
            oreType[idx] = OreMaterial.Gold
          }
        }

        // Adamantine (storageZ 4-15) — extended range for smaller worlds
        if (storageZ >= 4 && storageZ <= 15) {
          const v = fBm2d(wx + 11.1, wy + storageZ * 0.15, 3, 2.0, 0.5, adamPerm)
          if (v > ORE_THRESHOLD + 0.04) {
            oreType[idx] = OreMaterial.Adamantine
          }
        }

        // Magma at deepest layer (storageZ = depth-1, i.e. 15)
        // Applied in tile resolver, but mark isCavern = 0 here (no cavern at magma floor)
        if (storageZ === depth - 1) {
          isCavern[idx] = 0
          oreType[idx] = OreMaterial.None
        }
      }
    }
  }

  // Suppress unused rng warning
  void rng

  return { stoneType, oreType, isCavern }
}
