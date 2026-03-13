import { makePerm, fBm2d } from '@map/biomes'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

/**
 * Generate a heightmap for the world using fractional Brownian motion.
 * Returns a Float32Array of size width * height with values in [0, 1].
 * Index: y * width + x
 */
export function generateHeightmap(
  seed: number,
  width: number = WORLD_WIDTH,
  height: number = WORLD_HEIGHT,
): Float32Array {
  const perm = makePerm(seed ^ 0x9E3779B9)
  const result = new Float32Array(width * height)

  // First pass: compute raw fBm values
  let minVal = Infinity
  let maxVal = -Infinity

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = fBm2d(x / 64, y / 64, 6, 2.0, 0.5, perm)
      const idx = y * width + x
      result[idx] = e
      if (e < minVal) minVal = e
      if (e > maxVal) maxVal = e
    }
  }

  // Normalize to [0, 1] and apply power function for dramatic peaks
  const range = maxVal - minVal
  const invRange = range > 0 ? 1 / range : 1
  for (let i = 0; i < result.length; i++) {
    // Clamp to [0, 1] before power to avoid NaN from floating-point imprecision
    const normalized = Math.max(0, Math.min(1, ((result[i] ?? 0) - minVal) * invRange))
    result[i] = Math.pow(normalized, 1.3)
  }

  // Re-normalize after power function to ensure [0, 1]
  let min2 = Infinity
  let max2 = -Infinity
  for (let i = 0; i < result.length; i++) {
    const v = result[i] ?? 0
    if (v < min2) min2 = v
    if (v > max2) max2 = v
  }
  const range2 = max2 - min2
  const invRange2 = range2 > 0 ? 1 / range2 : 1
  for (let i = 0; i < result.length; i++) {
    result[i] = ((result[i] ?? 0) - min2) * invRange2
  }

  return result
}
