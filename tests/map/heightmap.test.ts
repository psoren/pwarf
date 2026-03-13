import { describe, it, expect } from 'vitest'
import { generateHeightmap } from '@map/generators/heightmap'

describe('generateHeightmap', () => {
  it('all values are in [0, 1]', () => {
    const hm = generateHeightmap(12345, 64, 64)
    for (let i = 0; i < hm.length; i++) {
      const v = hm[i] ?? 0
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('same seed produces identical output', () => {
    const a = generateHeightmap(99999, 32, 32)
    const b = generateHeightmap(99999, 32, 32)
    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i++) {
      expect(a[i]).toBe(b[i])
    }
  })

  it('different seeds produce different outputs', () => {
    const a = generateHeightmap(1, 32, 32)
    const b = generateHeightmap(2, 32, 32)
    let differs = false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        differs = true
        break
      }
    }
    expect(differs).toBe(true)
  })

  it('has standard deviation > 0.10 (meaningful variation)', () => {
    const hm = generateHeightmap(42, 128, 128)
    let sum = 0
    for (let i = 0; i < hm.length; i++) sum += hm[i] ?? 0
    const mean = sum / hm.length

    let variance = 0
    for (let i = 0; i < hm.length; i++) {
      const diff = (hm[i] ?? 0) - mean
      variance += diff * diff
    }
    variance /= hm.length
    const std = Math.sqrt(variance)
    expect(std).toBeGreaterThan(0.10)
  })
})
