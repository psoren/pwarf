export const enum BiomeType {
  Ocean         = 0,
  Tundra        = 1,
  Desert        = 2,
  Grassland     = 3,
  Forest        = 4,
  Savanna       = 5,
  TropicalForest = 6,
  Rainforest    = 7,
}

/**
 * Mulberry32 PRNG — fast, seedable, good quality for procedural generation.
 * Returns a function that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0
  return function (): number {
    s = (s + 0x6D2B79F5) | 0
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    z = (z ^ (z >>> 14)) >>> 0
    return z / 0x100000000
  }
}

/**
 * Build a shuffled permutation table (256 entries, doubled to 512)
 * using the given seed. Used for gradient noise.
 */
export function makePerm(seed: number): Uint8Array {
  const rng = mulberry32(seed)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = p[i]!
    p[i] = p[j]!
    p[j] = tmp
  }

  // Double the table to avoid index wrapping
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]!
  }
  return perm
}

// Gradient vectors for 2D Perlin noise
const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a)
}

function grad2(hash: number, x: number, y: number): number {
  const g = GRAD2[hash & 7]!
  return g[0] * x + g[1] * y
}

/**
 * 2D gradient noise (Perlin-style) using a precomputed permutation table.
 * Returns a value in approximately [-1, 1].
 */
export function noise2d(x: number, y: number, perm: Uint8Array): number {
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)

  const u = fade(xf)
  const v = fade(yf)

  const aa = (perm[xi + (perm[yi]! & 255)]!) & 255
  const ab = (perm[xi + (perm[yi + 1]! & 255)]!) & 255
  const ba = (perm[xi + 1 + (perm[yi]! & 255)]!) & 255
  const bb = (perm[xi + 1 + (perm[yi + 1]! & 255)]!) & 255

  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u)
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u)
  return lerp(x1, x2, v)
}

/**
 * Fractional Brownian Motion: layers multiple octaves of noise.
 * Returns a value in [0, 1] (normalized).
 */
export function fBm2d(
  x: number,
  y: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  perm: Uint8Array,
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let maxValue = 0

  for (let i = 0; i < octaves; i++) {
    value += noise2d(x * frequency, y * frequency, perm) * amplitude
    maxValue += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  // Normalize to [0, 1]
  return (value / maxValue) * 0.5 + 0.5
}
