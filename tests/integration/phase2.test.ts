import { describe, it, expect } from 'vitest'
import { HeadlessGame } from '@core/HeadlessGame'
import { getTile, setTile } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { ItemType, ItemMaterial } from '@core/components/item'
import { StockpileCategory } from '@core/components/zone'

describe('Phase 2 integration', () => {
  it('dwarves mine a designation in < 2000 ticks', () => {
    const game = new HeadlessGame({ seed: 42, width: 32, height: 32, depth: 4 })
    game.embark()
    const map = game.getMap()

    // Place food and drink items near dwarves (center is ~16,16)
    for (let i = 0; i < 20; i++) {
      game.placeItem(ItemType.Food, ItemMaterial.Plump, 10 + (i % 5), 10, 0)
      game.placeItem(ItemType.Drink, ItemMaterial.None, 10 + (i % 5), 11, 0)
    }

    // Manually set the 4×4 mine area to Stone (surface is Grass by default)
    for (let y = 4; y <= 7; y++) {
      for (let x = 4; x <= 7; x++) {
        setTile(x, y, 0, map, TileType.Stone)
      }
    }

    // Designate stone tiles at x=4..7, y=4..7, z=0 for mining
    game.designateMineArea(4, 4, 7, 7, 0)

    // Stockpile at x=20..23, y=4..7
    game.designateStockpileArea(20, 4, 23, 7, 0, StockpileCategory.Stone | StockpileCategory.Ore)

    // Run simulation
    game.runFor(2000)

    // At least some tiles should be mined
    let minedCount = 0
    for (let y = 4; y <= 7; y++) {
      for (let x = 4; x <= 7; x++) {
        if (getTile(x, y, 0, map) === TileType.Floor) minedCount++
      }
    }
    expect(minedCount).toBeGreaterThan(0)

    // Dwarves still alive
    const dwarves = game.getDwarves()
    expect(dwarves).toHaveLength(7)
    for (const d of dwarves) {
      expect(d.hunger).toBeGreaterThan(0)
      expect(d.thirst).toBeGreaterThan(0)
    }
  }, 30_000)

  it('idle dwarves wander — positions change over 100 ticks', () => {
    const game = new HeadlessGame({ seed: 1, width: 32, height: 32, depth: 2 })
    game.embark()
    const before = game.getDwarves().map(d => ({ x: d.x, y: d.y }))
    game.runFor(100)
    const after = game.getDwarves().map(d => ({ x: d.x, y: d.y }))
    // At least one dwarf should have moved (wander chance 15% per tick over 100 ticks)
    const moved = after.filter((d, i) => d.x !== before[i]!.x || d.y !== before[i]!.y)
    expect(moved.length).toBeGreaterThan(0)
  })

  it('dwarves have state field in DwarfStatus', () => {
    const game = new HeadlessGame({ seed: 1, width: 32, height: 32, depth: 2 })
    game.embark()
    const dwarves = game.getDwarves()
    for (const d of dwarves) {
      expect(typeof d.state).toBe('number')
      expect(d.state).toBe(0)  // Idle
    }
  })

  it('needs stay within bounds after 1000 ticks', () => {
    const game = new HeadlessGame({ seed: 1, width: 32, height: 32, depth: 2 })
    game.embark()
    game.runFor(1000)
    const after = game.getDwarves()
    // Dwarves eat/drink so needs fluctuate — just verify they stay in [0, 1]
    for (const d of after) {
      expect(d.hunger).toBeGreaterThanOrEqual(0)
      expect(d.hunger).toBeLessThanOrEqual(1)
      expect(d.thirst).toBeGreaterThanOrEqual(0)
      expect(d.thirst).toBeLessThanOrEqual(1)
    }
  })

  it('placeItem returns a valid eid', () => {
    const game = new HeadlessGame({ seed: 1, width: 32, height: 32, depth: 2 })
    game.embark()
    const eid = game.placeItem(ItemType.Food, ItemMaterial.Plump, 10, 10, 0)
    expect(typeof eid).toBe('number')
    expect(eid).toBeGreaterThanOrEqual(0)
  })
})
