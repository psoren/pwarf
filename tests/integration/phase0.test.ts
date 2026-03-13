import { describe, it, expect } from 'vitest'
import { HeadlessGame } from '@core/HeadlessGame'
import { WORLD_WIDTH, WORLD_HEIGHT } from '@core/constants'

describe('Phase 0 integration', () => {
  it('runs 100 ticks without error', () => {
    const game = new HeadlessGame({ seed: 42 })
    game.embark()
    const state = game.runFor(100)
    expect(state.dwarves.length).toBeGreaterThan(0)
    expect(state.tick).toBe(100)
  })

  it('dwarves stay within world bounds after 100 ticks', () => {
    const game = new HeadlessGame({ seed: 7 })
    game.embark()
    const state = game.runFor(100)
    for (const d of state.dwarves) {
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.y).toBeGreaterThanOrEqual(0)
      expect(d.x).toBeLessThan(WORLD_WIDTH)
      expect(d.y).toBeLessThan(WORLD_HEIGHT)
    }
  })
})
