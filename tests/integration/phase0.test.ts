import { describe, it, expect } from 'vitest'
import { HeadlessGame } from '@core/HeadlessGame'

describe('Phase 0 integration', () => {
  it('runs 100 ticks without error', () => {
    const game = new HeadlessGame({ seed: 42 })
    game.embark()
    const state = game.runFor(100)
    expect(state.dwarves.length).toBeGreaterThan(0)
    expect(state.tick).toBe(100)
  })

  it('spawns exactly 7 dwarves on embark', () => {
    const game = new HeadlessGame({ seed: 1 })
    game.embark()
    const state = game.runFor(0)
    expect(state.dwarves.length).toBe(7)
  })

  it('dwarves stay within world bounds after 100 ticks', () => {
    const game = new HeadlessGame({ seed: 7 })
    game.embark()
    const state = game.runFor(100)
    for (const d of state.dwarves) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThan(128)
      expect(d.y).toBeLessThan(128)
    }
  })
})
