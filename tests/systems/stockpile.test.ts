import { describe, it, expect, beforeEach } from 'vitest'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { addEntity, addComponent } from 'bitecs'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { StockpileCategory } from '@core/components/zone'
import {
  designateStockpile,
  itemTypeToCategory,
  isStockpileAccepting,
  getOpenStockpileTile,
  findAcceptingStockpile,
} from '@systems/stockpile'
import { zoneItemStore } from '@core/stores'

describe('stockpile system', () => {
  let world: GameWorld

  beforeEach(() => {
    world = createGameWorld()
    zoneItemStore.clear()
  })

  describe('designateStockpile', () => {
    it('creates a zone entity with correct bounds and categories', () => {
      const zoneEid = designateStockpile(world, 0, 0, 5, 5, 0, StockpileCategory.Stone)
      expect(zoneEid).toBeGreaterThanOrEqual(0)
      expect(zoneItemStore.has(zoneEid)).toBe(true)
    })
  })

  describe('itemTypeToCategory', () => {
    it('maps Stone → Stone category', () => {
      expect(itemTypeToCategory(ItemType.Stone)).toBe(StockpileCategory.Stone)
    })
    it('maps Ore → Ore category', () => {
      expect(itemTypeToCategory(ItemType.Ore)).toBe(StockpileCategory.Ore)
    })
    it('maps Food → Food category', () => {
      expect(itemTypeToCategory(ItemType.Food)).toBe(StockpileCategory.Food)
    })
    it('maps Drink → Drink category', () => {
      expect(itemTypeToCategory(ItemType.Drink)).toBe(StockpileCategory.Drink)
    })
  })

  describe('isStockpileAccepting', () => {
    it('returns true when zone accepts the item type', () => {
      const zoneEid = designateStockpile(world, 0, 0, 4, 4, 0, StockpileCategory.Stone)
      expect(isStockpileAccepting(world, zoneEid, ItemType.Stone)).toBe(true)
    })

    it('returns false when zone does not accept the item type', () => {
      const zoneEid = designateStockpile(world, 0, 0, 4, 4, 0, StockpileCategory.Stone)
      expect(isStockpileAccepting(world, zoneEid, ItemType.Food)).toBe(false)
    })

    it('All category accepts everything', () => {
      const zoneEid = designateStockpile(world, 0, 0, 4, 4, 0, StockpileCategory.All)
      expect(isStockpileAccepting(world, zoneEid, ItemType.Stone)).toBe(true)
      expect(isStockpileAccepting(world, zoneEid, ItemType.Food)).toBe(true)
      expect(isStockpileAccepting(world, zoneEid, ItemType.Drink)).toBe(true)
    })
  })

  describe('getOpenStockpileTile', () => {
    it('returns a tile within zone bounds when zone is empty', () => {
      const zoneEid = designateStockpile(world, 5, 5, 7, 7, 0, StockpileCategory.Stone)
      const tile = getOpenStockpileTile(world, zoneEid)
      expect(tile).not.toBeNull()
      expect(tile!.x).toBeGreaterThanOrEqual(5)
      expect(tile!.x).toBeLessThanOrEqual(7)
      expect(tile!.y).toBeGreaterThanOrEqual(5)
      expect(tile!.y).toBeLessThanOrEqual(7)
      expect(tile!.z).toBe(0)
    })

    it('returns null when zone is full', () => {
      const zoneEid = designateStockpile(world, 0, 0, 0, 0, 0, StockpileCategory.Stone)
      // Fill the single tile with an item
      const itemEid = addEntity(world)
      addComponent(world, itemEid, Item)
      Item.x[itemEid] = 0
      Item.y[itemEid] = 0
      Item.carriedBy[itemEid] = -1
      const s = zoneItemStore.get(zoneEid) ?? new Set<number>()
      s.add(itemEid)
      zoneItemStore.set(zoneEid, s)
      const tile = getOpenStockpileTile(world, zoneEid)
      expect(tile).toBeNull()
    })
  })

  describe('findAcceptingStockpile', () => {
    it('returns zone eid when a stockpile accepts the item type', () => {
      const zoneEid = designateStockpile(world, 0, 0, 5, 5, 0, StockpileCategory.Stone)
      const found = findAcceptingStockpile(world, ItemType.Stone)
      expect(found).toBe(zoneEid)
    })

    it('returns null when no stockpile accepts the item type', () => {
      designateStockpile(world, 0, 0, 5, 5, 0, StockpileCategory.Stone)
      const found = findAcceptingStockpile(world, ItemType.Food)
      expect(found).toBeNull()
    })

    it('returns null when stockpile is full', () => {
      const zoneEid = designateStockpile(world, 0, 0, 0, 0, 0, StockpileCategory.Stone)
      // Fill the single tile
      const itemEid = addEntity(world)
      addComponent(world, itemEid, Item)
      Item.itemType[itemEid] = ItemType.Stone
      Item.material[itemEid] = ItemMaterial.Granite
      Item.x[itemEid] = 0
      Item.y[itemEid] = 0
      Item.carriedBy[itemEid] = -1
      const s = zoneItemStore.get(zoneEid) ?? new Set<number>()
      s.add(itemEid)
      zoneItemStore.set(zoneEid, s)
      expect(findAcceptingStockpile(world, ItemType.Stone)).toBeNull()
    })
  })
})
