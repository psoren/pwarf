import { describe, it, expect, beforeEach } from 'vitest'
import { HeadlessGame } from '@core/HeadlessGame'

describe('HeadlessGame', () => {
  let game: HeadlessGame

  beforeEach(() => {
    game = new HeadlessGame({ seed: 42, width: 32, height: 32, depth: 4 })
  })

  describe('embark()', () => {
    it('spawns exactly 7 dwarves', () => {
      game.embark()
      expect(game.getDwarves()).toHaveLength(7)
    })

    it('places dwarves at the center of the map at z=0', () => {
      game.embark()
      const dwarves = game.getDwarves()
      for (const dwarf of dwarves) {
        expect(dwarf.x).toBe(16)   // Math.floor(32 / 2)
        expect(dwarf.y).toBe(16)
        expect(dwarf.z).toBe(0)
      }
    })

    it('resets the tick counter on re-embark', () => {
      game.embark()
      game.tick()
      game.embark()
      const state = game.tick()
      expect(state.tick).toBe(1)
    })
  })

  describe('tick()', () => {
    it('increments the tick counter by 1', () => {
      game.embark()
      const s1 = game.tick()
      expect(s1.tick).toBe(1)
      const s2 = game.tick()
      expect(s2.tick).toBe(2)
    })

    it('returns a GameState with dwarves and stocks fields', () => {
      game.embark()
      const state = game.tick()
      expect(state).toHaveProperty('tick')
      expect(state).toHaveProperty('dwarves')
      expect(state).toHaveProperty('stocks')
    })

    it('throws if called before embark()', () => {
      expect(() => game.tick()).toThrow('Call embark() before tick()')
    })
  })

  describe('runFor(n)', () => {
    it('returns GameState with tick === n after running n ticks', () => {
      game.embark()
      const state = game.runFor(10)
      expect(state.tick).toBe(10)
    })

    it('returns tick === 0 when n === 0', () => {
      game.embark()
      const state = game.runFor(0)
      expect(state.tick).toBe(0)
    })

    it('accumulates ticks across multiple runFor calls', () => {
      game.embark()
      game.runFor(5)
      const state = game.runFor(3)
      expect(state.tick).toBe(8)
    })

    it('throws if called before embark()', () => {
      expect(() => game.runFor(1)).toThrow('Call embark() before runFor()')
    })
  })

  describe('designateMine()', () => {
    it('stores a single mine designation', () => {
      game.embark()
      game.designateMine(1, 2, 0, 5, 6, 0)
      const designations = game.getMineDesignations()
      expect(designations).toHaveLength(1)
      expect(designations[0]).toEqual({ x1: 1, y1: 2, z1: 0, x2: 5, y2: 6, z2: 0 })
    })

    it('stores multiple designations independently', () => {
      game.embark()
      game.designateMine(0, 0, 0, 2, 2, 0)
      game.designateMine(10, 10, 1, 15, 15, 1)
      expect(game.getMineDesignations()).toHaveLength(2)
    })
  })

  describe('getStocks()', () => {
    it('returns an empty array (stocks system not yet built)', () => {
      game.embark()
      expect(game.getStocks()).toEqual([])
    })
  })

  describe('getDwarves()', () => {
    it('returns DwarfStatus objects with required fields', () => {
      game.embark()
      const dwarves = game.getDwarves()
      expect(dwarves.length).toBeGreaterThan(0)
      const dwarf = dwarves[0]!
      expect(typeof dwarf.eid).toBe('number')
      expect(typeof dwarf.x).toBe('number')
      expect(typeof dwarf.y).toBe('number')
      expect(typeof dwarf.z).toBe('number')
      expect(typeof dwarf.hunger).toBe('number')
      expect(typeof dwarf.thirst).toBe('number')
      expect(typeof dwarf.sleep).toBe('number')
      expect(typeof dwarf.happiness).toBe('number')
      expect(dwarf.job === null || typeof dwarf.job === 'string').toBe(true)
    })

    it('throws if called before embark()', () => {
      expect(() => game.getDwarves()).toThrow('Call embark() before getDwarves()')
    })
  })

  describe('no browser globals', () => {
    it('runs ticks without accessing window, document, or requestAnimationFrame', () => {
      // This test runs in Node/Vitest without jsdom. If any browser global were
      // accessed, an error would be thrown here.
      game.embark()
      game.runFor(10)
      expect(game.getDwarves()).toHaveLength(7)
    })
  })
})
