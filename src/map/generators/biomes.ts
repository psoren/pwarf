import { BiomeType, makePerm, fBm2d } from '@map/biomes'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

/**
 * Assign biomes to each tile based on elevation, temperature, and moisture.
 * Returns a Uint8Array of BiomeType values, indexed by y * width + x.
 */
export function generateBiomes(
  heightmap: Float32Array,
  seed: number,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
): Uint8Array {
  const biomePerm = makePerm(seed ^ 0x243F6A88)
  const moisturePerm = makePerm((seed ^ 0x243F6A88) + 1)
  const result = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const elevation = heightmap[idx] ?? 0

      // Ocean where elevation < 0.35
      if (elevation < 0.35) {
        result[idx] = BiomeType.Ocean
        continue
      }

      // Temperature: cooler at high elevation and high latitude (north = y=0)
      const tempNoise = fBm2d(x / 64, y / 64, 3, 2.0, 0.5, biomePerm) * 2 - 1  // [-1, 1]
      const temperature = 1.0 - elevation * 0.4 - (y / height) * 0.3 + tempNoise * 0.1

      // Moisture
      const moisture = fBm2d(x / 48, y / 48, 4, 2.0, 0.5, moisturePerm)

      // Biome classification
      result[idx] = classifyBiome(elevation, temperature, moisture)
    }
  }

  return result
}

function classifyBiome(elevation: number, temperature: number, moisture: number): BiomeType {
  // Mountain peak
  if (elevation >= 0.80) return BiomeType.Tundra

  // Cold / tundra
  if (temperature < 0.25) return BiomeType.Tundra

  // Hot desert
  if (temperature > 0.75 && moisture < 0.3) return BiomeType.Desert

  // Warm and dry
  if (temperature > 0.55 && moisture < 0.4) return BiomeType.Savanna

  // Tropical (hot + wet)
  if (temperature > 0.70 && moisture > 0.6) {
    return moisture > 0.8 ? BiomeType.Rainforest : BiomeType.TropicalForest
  }

  // Temperate wet
  if (moisture > 0.55) return BiomeType.Forest

  return BiomeType.Grassland
}
