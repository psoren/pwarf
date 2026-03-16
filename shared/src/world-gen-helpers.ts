import type { NoiseFunction2D } from "simplex-noise";
import type { TerrainType } from "./db-types.js";

// ============================================================
// Seeded PRNG (Alea algorithm by Johannes Baagoe)
// ============================================================

export function createAleaRng(seed: bigint): () => number {
  // Mix seed into three state variables using a simple hash
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let c = 1;

  const seedStr = seed.toString();

  // Mash function to initialize state from string
  function mash(data: string): number {
    let n = 0xefc8249d;
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000;
    }
    return (n >>> 0) * 2.3283064365386963e-10;
  }

  s0 = mash(" ");
  s1 = mash(" ");
  s2 = mash(" ");

  s0 -= mash(seedStr);
  if (s0 < 0) s0 += 1;
  s1 -= mash(seedStr);
  if (s1 < 0) s1 += 1;
  s2 -= mash(seedStr);
  if (s2 < 0) s2 += 1;

  return function () {
    const t = 2091639 * s0 + c * 2.3283064365386963e-10;
    s0 = s1;
    s1 = s2;
    c = t | 0;
    s2 = t - c;
    return s2;
  };
}

// ============================================================
// Fractal Brownian Motion
// ============================================================

export function fbm(
  noise2D: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  frequency: number,
  amplitude: number
): number {
  let value = 0;
  let freq = frequency;
  let amp = amplitude;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= 2;
    amp *= 0.5;
  }

  // Normalize to [0, 1] — noise2D returns [-1, 1]
  return (value / maxAmp + 1) / 2;
}

// ============================================================
// Terrain derivation
// ============================================================

export function deriveTerrain(
  elevation: number,
  moisture: number,
  temperature: number
): TerrainType {
  // Priority-ordered rules from design spec
  if (elevation < 0.25) return "ocean";
  if (elevation > 0.85 && temperature < 0.3) return "tundra";
  if (elevation > 0.85) return "mountain";
  if (elevation > 0.75 && moisture < 0.2 && temperature > 0.7) return "volcano";
  if (temperature < 0.15) return "tundra";
  if (moisture > 0.7 && temperature > 0.6) return "swamp";
  if (moisture < 0.2 && temperature > 0.6) return "desert";
  if (moisture > 0.5 && temperature > 0.3) return "forest";
  if (elevation > 0.6) return "mountain";
  return "plains";
}

// ============================================================
// Biome tags derivation
// ============================================================

export function deriveBiomeTags(
  elevation: number,
  moisture: number,
  temperature: number
): string[] {
  const tags: string[] = [];

  // Temperature tags
  if (temperature < 0.2) tags.push("freezing");
  else if (temperature < 0.4) tags.push("cold");
  else if (temperature < 0.6) tags.push("temperate");
  else if (temperature < 0.8) tags.push("warm");
  else tags.push("hot");

  // Moisture tags
  if (moisture < 0.2) tags.push("arid");
  else if (moisture < 0.4) tags.push("dry");
  else if (moisture < 0.6) tags.push("moderate");
  else if (moisture < 0.8) tags.push("humid");
  else tags.push("drenched");

  // Elevation tags
  if (elevation < 0.25) tags.push("submerged");
  else if (elevation < 0.4) tags.push("lowland");
  else if (elevation < 0.6) tags.push("midland");
  else if (elevation < 0.8) tags.push("highland");
  else tags.push("alpine");

  return tags;
}

// ============================================================
// Special terrain overlay
// ============================================================

export type SpecialTerrain = "underground" | "haunted" | "savage" | "evil";

export const SPECIAL_TERRAINS: SpecialTerrain[] = [
  "underground",
  "haunted",
  "savage",
  "evil",
];

export function deriveSpecialOverlay(
  specialNoises: NoiseFunction2D[],
  x: number,
  y: number,
  frequency: number
): TerrainType | null {
  for (let i = 0; i < specialNoises.length; i++) {
    const value = (specialNoises[i](x * frequency, y * frequency) + 1) / 2;
    if (value > 0.95) {
      return SPECIAL_TERRAINS[i];
    }
  }
  return null;
}

// ============================================================
// Elevation to meters conversion
// ============================================================

export function elevationToMeters(normalizedElevation: number): number {
  // Map [0, 1] to [-200, 2000] meters
  // Ocean (< 0.25) maps to roughly [-200, 300]
  // Mountains (> 0.85) maps to roughly [1700, 2000]
  return Math.round(normalizedElevation * 2200 - 200);
}
