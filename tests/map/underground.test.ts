import { describe, it, expect } from 'vitest'
import { generateHeightmap } from '@map/generators/heightmap'
import { generateUnderground } from '@map/generators/underground'
import { OreMaterial } from '@map/materials'
import { WORLD_DEPTH } from '@core/constants'

describe('generateUnderground', () => {
  const width = 128
  const height = 128
  const depth = WORLD_DEPTH

  function ugIndex(x: number, y: number, storageZ: number): number {
    return (storageZ - 1) * width * height + y * width + x
  }

  it('contains each ore type at least 5 times', () => {
    const hm = generateHeightmap(12345, width, height)
    const ug = generateUnderground(hm, 12345, width, height, depth)

    const oreCounts = new Map<number, number>()
    for (let i = 0; i < ug.oreType.length; i++) {
      const o = ug.oreType[i] ?? 0
      if (o !== OreMaterial.None) {
        oreCounts.set(o, (oreCounts.get(o) ?? 0) + 1)
      }
    }

    // All ore types should be present
    for (const ore of [OreMaterial.Coal, OreMaterial.Iron, OreMaterial.Copper, OreMaterial.Gold, OreMaterial.Adamantine]) {
      const count = oreCounts.get(ore) ?? 0
      expect(count, `OreMaterial ${ore} should appear ≥ 5 times`).toBeGreaterThanOrEqual(5)
    }
  })

  it('cavern tiles make up at least 1% of underground volume', () => {
    const hm = generateHeightmap(42, width, height)
    const ug = generateUnderground(hm, 42, width, height, depth)

    let cavernCount = 0
    for (let i = 0; i < ug.isCavern.length; i++) {
      if ((ug.isCavern[i] ?? 0) === 1) cavernCount++
    }

    const total = ug.isCavern.length
    expect(cavernCount / total).toBeGreaterThanOrEqual(0.01)
  })

  it('deepest layer (storageZ=15) has no caverns and no ores', () => {
    const hm = generateHeightmap(7777, width, height)
    const ug = generateUnderground(hm, 7777, width, height, depth)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = ugIndex(x, y, depth - 1)
        expect(ug.isCavern[i] ?? 0).toBe(0)
        expect(ug.oreType[i] ?? 0).toBe(OreMaterial.None)
      }
    }
  })

  it('uses all WORLD_DEPTH-1 layers', () => {
    const hm = generateHeightmap(1, width, height)
    const ug = generateUnderground(hm, 1, width, height, depth)
    const expectedSize = width * height * (depth - 1)
    expect(ug.stoneType.length).toBe(expectedSize)
    expect(ug.oreType.length).toBe(expectedSize)
    expect(ug.isCavern.length).toBe(expectedSize)
  })
})
