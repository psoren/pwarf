import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { consumptionSystem } from '@systems/consumptionSystem'
import { pathStore, pathIndexStore } from '@core/stores'

function makeGrassMap(w = 20, h = 20): World3D {
  const map = createWorld3D(w, h, 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setTile(x, y, 0, map, TileType.Grass)
    }
  }
  return map
}

function makeEater(world: GameWorld, x: number, y: number, state: DwarfState): number {
  const eid = addEntity(world)
  addComponent(world, eid, DwarfAI)
  addComponent(world, eid, Needs)
  addComponent(world, eid, TileCoord)
  TileCoord.x[eid] = x
  TileCoord.y[eid] = y
  TileCoord.z[eid] = 0
  DwarfAI.state[eid] = state
  DwarfAI.eatTargetEid[eid] = -1
  DwarfAI.drinkTargetEid[eid] = -1
  Needs.hunger[eid] = 0.1
  Needs.thirst[eid] = 0.1
  Needs.sleep[eid] = 1.0
  return eid
}

function makeFoodItem(world: GameWorld, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, Item)
  Item.itemType[eid] = ItemType.Food
  Item.material[eid] = ItemMaterial.Plump
  Item.quality[eid] = 1
  Item.carriedBy[eid] = -1
  Item.x[eid] = x
  Item.y[eid] = y
  Item.z[eid] = 0
  return eid
}

function makeDrinkItem(world: GameWorld, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, Item)
  Item.itemType[eid] = ItemType.Drink
  Item.material[eid] = ItemMaterial.None
  Item.quality[eid] = 1
  Item.carriedBy[eid] = -1
  Item.x[eid] = x
  Item.y[eid] = y
  Item.z[eid] = 0
  return eid
}

describe('consumptionSystem', () => {
  let world: GameWorld
  let map: World3D

  beforeEach(() => {
    world = createGameWorld()
    map = makeGrassMap()
    pathStore.clear()
    pathIndexStore.clear()
  })

  it('restores hunger when dwarf arrives at food item', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Eating)
    const foodEid = makeFoodItem(world, 5, 5)  // same tile
    DwarfAI.eatTargetEid[eid] = foodEid

    consumptionSystem(world, map, 0)

    expect(Needs.hunger[eid]).toBeCloseTo(1.0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
  })

  it('restores thirst when dwarf arrives at drink item', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Drinking)
    const drinkEid = makeDrinkItem(world, 5, 5)
    DwarfAI.drinkTargetEid[eid] = drinkEid

    consumptionSystem(world, map, 0)

    expect(Needs.thirst[eid]).toBeCloseTo(1.0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
  })

  it('sets path when food is not at same tile', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Eating)
    const foodEid = makeFoodItem(world, 8, 5)  // different tile
    DwarfAI.eatTargetEid[eid] = foodEid

    consumptionSystem(world, map, 0)

    expect(pathStore.has(eid)).toBe(true)
  })

  it('does not consume when not in Eating or Drinking state', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Idle)
    makeFoodItem(world, 5, 5)

    consumptionSystem(world, map, 0)

    expect(Needs.hunger[eid]).toBeCloseTo(0.1)  // unchanged
  })

  it('stays in Eating state when no food is available', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Eating)
    // No food items placed

    consumptionSystem(world, map, 0)

    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Eating)
  })

  it('finds nearest food item automatically', () => {
    const eid = makeEater(world, 5, 5, DwarfState.Eating)
    DwarfAI.eatTargetEid[eid] = -1  // no target yet
    const farFood = makeFoodItem(world, 15, 5)    // dist=10
    const nearFood = makeFoodItem(world, 6, 5)    // dist=1

    consumptionSystem(world, map, 0)

    // Should have targeted the near food
    expect(DwarfAI.eatTargetEid[eid]).toBe(nearFood)
    // farFood should be ignored
    expect(DwarfAI.eatTargetEid[eid]).not.toBe(farFood)
  })
})
