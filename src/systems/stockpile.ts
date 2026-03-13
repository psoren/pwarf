import { addEntity, addComponent, query } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Zone, ZoneType, StockpileCategory } from '@core/components/zone'
import { Item, ItemType } from '@core/components/item'
import { zoneItemStore } from '@core/stores'

export { StockpileCategory }

/**
 * Create a stockpile zone entity.
 */
export function designateStockpile(
  world: GameWorld,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  z: number,
  categories: number,
): number {
  const eid = addEntity(world)
  addComponent(world, eid, Zone)
  Zone.zoneType[eid] = ZoneType.Stockpile
  Zone.x1[eid] = Math.min(x1, x2)
  Zone.y1[eid] = Math.min(y1, y2)
  Zone.x2[eid] = Math.max(x1, x2)
  Zone.y2[eid] = Math.max(y1, y2)
  Zone.z[eid] = z
  Zone.categories[eid] = categories
  zoneItemStore.set(eid, new Set())
  return eid
}

/**
 * Map an ItemType to a StockpileCategory bitmask.
 */
export function itemTypeToCategory(t: ItemType): StockpileCategory {
  switch (t) {
    case ItemType.Stone:     return StockpileCategory.Stone
    case ItemType.Ore:       return StockpileCategory.Ore
    case ItemType.Log:       return StockpileCategory.Wood
    case ItemType.Food:      return StockpileCategory.Food
    case ItemType.Drink:     return StockpileCategory.Drink
    case ItemType.Seed:      return StockpileCategory.Food
    case ItemType.Pick:      return StockpileCategory.Weapons
    case ItemType.Axe:       return StockpileCategory.Weapons
    case ItemType.Sword:     return StockpileCategory.Weapons
    case ItemType.Armor:     return StockpileCategory.Armor
    case ItemType.Bar:       return StockpileCategory.Stone
    case ItemType.Furniture: return StockpileCategory.Furniture
    default:                 return StockpileCategory.Stone
  }
}

/**
 * Returns true if the given stockpile zone accepts the given item type.
 */
export function isStockpileAccepting(world: GameWorld, zoneEid: number, itemType: ItemType): boolean {
  if (!query(world, [Zone]).includes(zoneEid)) return false
  if ((Zone.zoneType[zoneEid] as ZoneType) !== ZoneType.Stockpile) return false
  const cats = Zone.categories[zoneEid] ?? 0
  const itemCat = itemTypeToCategory(itemType)
  return (cats & itemCat) !== 0
}

/**
 * Get an open tile (not yet occupied by an item) within a stockpile zone.
 */
export function getOpenStockpileTile(
  world: GameWorld,
  zoneEid: number,
): { x: number; y: number; z: number } | null {
  if (!query(world, [Zone]).includes(zoneEid)) return null

  const x1 = Zone.x1[zoneEid] ?? 0
  const y1 = Zone.y1[zoneEid] ?? 0
  const x2 = Zone.x2[zoneEid] ?? 0
  const y2 = Zone.y2[zoneEid] ?? 0
  const z  = Zone.z[zoneEid] ?? 0

  const occupiedItems = zoneItemStore.get(zoneEid) ?? new Set<number>()

  // Build set of occupied positions
  const occupiedPositions = new Set<string>()
  for (const itemEid of occupiedItems) {
    // Check the item still exists and is at its stockpile position
    if ((Item.carriedBy[itemEid] ?? -1) === -1) {
      occupiedPositions.add(`${Item.x[itemEid] ?? 0},${Item.y[itemEid] ?? 0}`)
    }
  }

  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (!occupiedPositions.has(`${x},${y}`)) {
        return { x, y, z }
      }
    }
  }

  return null
}

/**
 * Find the first stockpile zone that accepts the given item type and has open space.
 * Returns zone eid or null.
 */
export function findAcceptingStockpile(world: GameWorld, itemType: ItemType): number | null {
  const zones = query(world, [Zone])
  for (let i = 0; i < zones.length; i++) {
    const zoneEid = zones[i]!
    if ((Zone.zoneType[zoneEid] as ZoneType) !== ZoneType.Stockpile) continue
    if (!isStockpileAccepting(world, zoneEid, itemType)) continue
    const open = getOpenStockpileTile(world, zoneEid)
    if (open !== null) return zoneEid
  }
  return null
}
