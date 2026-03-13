import { describe, it, expect } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import { Item, ItemType, ItemMaterial } from '@core/components/item'

describe('item component', () => {
  it('Item fields are readable after addComponent', () => {
    const world = createGameWorld()
    const eid = addEntity(world)
    addComponent(world, eid, Item)
    Item.itemType[eid] = ItemType.Stone
    Item.material[eid] = ItemMaterial.Granite
    Item.quality[eid] = 3
    Item.carriedBy[eid] = -1
    Item.x[eid] = 10
    Item.y[eid] = 20
    Item.z[eid] = 0
    expect(Item.itemType[eid]).toBe(ItemType.Stone)
    expect(Item.material[eid]).toBe(ItemMaterial.Granite)
    expect(Item.quality[eid]).toBe(3)
    expect(Item.carriedBy[eid]).toBe(-1)
    expect(Item.x[eid]).toBe(10)
    expect(Item.y[eid]).toBe(20)
    expect(Item.z[eid]).toBe(0)
  })

  it('carriedBy tracks which entity is carrying the item', () => {
    const world = createGameWorld()
    const itemEid = addEntity(world)
    const dwarfEid = 42
    addComponent(world, itemEid, Item)
    Item.carriedBy[itemEid] = -1
    expect(Item.carriedBy[itemEid]).toBe(-1)
    Item.carriedBy[itemEid] = dwarfEid
    expect(Item.carriedBy[itemEid]).toBe(dwarfEid)
  })

  it('ItemType enum values are distinct', () => {
    expect(ItemType.Stone).toBe(0)
    expect(ItemType.Ore).toBe(1)
    expect(ItemType.Food).toBe(3)
    expect(ItemType.Drink).toBe(4)
  })

  it('ItemMaterial enum values include stone and ore materials', () => {
    expect(ItemMaterial.None).toBe(0)
    expect(ItemMaterial.Granite).toBe(1)
    expect(ItemMaterial.IronOre).toBe(6)
    expect(ItemMaterial.Plump).toBe(13)
  })
})
