import { describe, it, expect } from 'vitest'
import { generateHeightmap } from '@map/generators/heightmap'
import { generateBiomes } from '@map/generators/biomes'
import { BiomeType } from '@map/biomes'

describe('generateBiomes', () => {
  it('produces at least 3 distinct biomes in a 128×128 world', () => {
    const hm = generateHeightmap(12345, 128, 128)
    const biomes = generateBiomes(hm, 12345, 128, 128)
    const distinct = new Set<number>()
    for (let i = 0; i < biomes.length; i++) {
      distinct.add(biomes[i] ?? 0)
    }
    expect(distinct.size).toBeGreaterThanOrEqual(3)
  })

  it('assigns Ocean where elevation < 0.35', () => {
    // Create a mostly-ocean heightmap by using a very low flat value
    const hm = new Float32Array(128 * 128).fill(0.1)
    const biomes = generateBiomes(hm, 0, 128, 128)
    for (let i = 0; i < biomes.length; i++) {
      expect(biomes[i]).toBe(BiomeType.Ocean)
    }
  })

  it('Ocean tiles correspond to low elevation', () => {
    const hm = generateHeightmap(999, 128, 128)
    const biomes = generateBiomes(hm, 999, 128, 128)
    for (let i = 0; i < biomes.length; i++) {
      const elev = hm[i] ?? 0
      if (biomes[i] === BiomeType.Ocean) {
        expect(elev).toBeLessThan(0.35)
      }
    }
  })

  it('no single non-ocean biome exceeds 60% of non-ocean tiles', () => {
    const hm = generateHeightmap(12345, 128, 128)
    const biomes = generateBiomes(hm, 12345, 128, 128)

    const counts = new Map<number, number>()
    let nonOcean = 0
    for (let i = 0; i < biomes.length; i++) {
      const b = biomes[i] ?? 0
      if (b !== BiomeType.Ocean) {
        nonOcean++
        counts.set(b, (counts.get(b) ?? 0) + 1)
      }
    }

    if (nonOcean > 0) {
      for (const [, count] of counts) {
        expect(count / nonOcean).toBeLessThanOrEqual(0.60)
      }
    }
  })
})
