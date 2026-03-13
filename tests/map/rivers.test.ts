import { describe, it, expect } from 'vitest'
import { generateHeightmap } from '@map/generators/heightmap'
import { generateRivers } from '@map/generators/rivers'

describe('generateRivers', () => {
  it('at least 1 river tile exists in 128×128 world with mountainous seed', () => {
    // Seed 12345 produces a varied heightmap with mountains
    const hm = generateHeightmap(12345, 128, 128)
    const rivers = generateRivers(hm, 12345, 128, 128)

    let riverCount = 0
    for (let i = 0; i < rivers.isRiver.length; i++) {
      if ((rivers.isRiver[i] ?? 0) === 1) riverCount++
    }
    expect(riverCount).toBeGreaterThanOrEqual(1)
  })

  it('all flow accumulation values are >= 1', () => {
    const hm = generateHeightmap(42, 64, 64)
    const rivers = generateRivers(hm, 42, 64, 64)
    for (let i = 0; i < rivers.flowAcc.length; i++) {
      expect(rivers.flowAcc[i] ?? 1).toBeGreaterThanOrEqual(1)
    }
  })

  it('river tiles only exist where elevation >= 0.35', () => {
    const hm = generateHeightmap(99, 64, 64)
    const rivers = generateRivers(hm, 99, 64, 64)
    for (let i = 0; i < rivers.isRiver.length; i++) {
      if ((rivers.isRiver[i] ?? 0) === 1) {
        expect(hm[i] ?? 0).toBeGreaterThanOrEqual(0.35)
      }
    }
  })

  it('output arrays have correct size', () => {
    const w = 64
    const h = 64
    const hm = generateHeightmap(1, w, h)
    const rivers = generateRivers(hm, 1, w, h)
    expect(rivers.isRiver.length).toBe(w * h)
    expect(rivers.isLake.length).toBe(w * h)
    expect(rivers.flowAcc.length).toBe(w * h)
  })
})
