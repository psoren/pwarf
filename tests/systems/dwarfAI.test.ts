import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { DwarfAI, DwarfState, Needs, Labor, ALL_LABORS } from '@core/components/dwarf'
import { Mood } from '@core/components/mood'
import { Position } from '@core/components/position'
import { TileCoord } from '@core/components/tileCoord'
// Job components used indirectly via system calls
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { dwarfAISystem } from '@systems/dwarfAISystem'
import { pathStore, pathIndexStore, designationStore } from '@core/stores'
import { designateMine } from '@systems/mineDesignation'

function makeGrassMap(w = 20, h = 20): World3D {
  const map = createWorld3D(w, h, 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setTile(x, y, 0, map, TileType.Grass)
    }
  }
  return map
}

function makeDwarf(world: GameWorld, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, Position)
  addComponent(world, eid, TileCoord)
  addComponent(world, eid, DwarfAI)
  addComponent(world, eid, Needs)
  addComponent(world, eid, Labor)
  addComponent(world, eid, Mood)
  Position.x[eid] = x
  Position.y[eid] = y
  Position.z[eid] = 0
  TileCoord.x[eid] = x
  TileCoord.y[eid] = y
  TileCoord.z[eid] = 0
  DwarfAI.state[eid] = DwarfState.Idle
  DwarfAI.jobEid[eid] = -1
  DwarfAI.eatTargetEid[eid] = -1
  DwarfAI.drinkTargetEid[eid] = -1
  Needs.hunger[eid] = 1.0
  Needs.thirst[eid] = 1.0
  Needs.sleep[eid] = 1.0
  Mood.happiness[eid] = 1.0
  Labor.enabled[eid] = ALL_LABORS
  return eid
}

describe('dwarfAISystem', () => {
  let world: GameWorld
  let map: World3D

  beforeEach(() => {
    world = createGameWorld()
    map = makeGrassMap()
    pathStore.clear()
    pathIndexStore.clear()
    designationStore.clear()
  })

  it('stays Idle when no jobs and needs are fine', () => {
    const eid = makeDwarf(world, 10, 10)
    dwarfAISystem(world, map, 0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
  })

  it('transitions to SeekingJob when mine jobs are available', () => {
    const eid = makeDwarf(world, 10, 10)
    // Place stone and designate for mining
    setTile(5, 5, 0, map, TileType.Stone)
    designateMine(world, map, [{ x: 5, y: 5, z: 0 }])

    dwarfAISystem(world, map, 0)
    // After Idle → SeekingJob → claim job, state should be ExecutingJob
    // (SeekingJob is processed in same tick as Idle due to switch fallthrough? No — separate tick)
    // Actually, Idle transitions to SeekingJob and that's it for this tick
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.SeekingJob)
  })

  it('claims a mine job when seeking', () => {
    const eid = makeDwarf(world, 10, 10)
    setTile(5, 5, 0, map, TileType.Stone)
    designateMine(world, map, [{ x: 5, y: 5, z: 0 }])

    // First tick: Idle → SeekingJob
    dwarfAISystem(world, map, 0)
    // Second tick: SeekingJob → ExecutingJob
    dwarfAISystem(world, map, 1)

    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.ExecutingJob)
    expect(DwarfAI.jobEid[eid]).toBeGreaterThanOrEqual(0)
  })

  it('transitions to Eating when hunger is critical and food is available', () => {
    const eid = makeDwarf(world, 10, 10)
    Needs.hunger[eid] = 0.1  // below threshold

    // Place a food item
    const foodEid = addEntity(world)
    addComponent(world, foodEid, Item)
    Item.itemType[foodEid] = ItemType.Food
    Item.material[foodEid] = ItemMaterial.Plump
    Item.carriedBy[foodEid] = -1
    Item.x[foodEid] = 5
    Item.y[foodEid] = 5
    Item.z[foodEid] = 0

    dwarfAISystem(world, map, 0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Eating)
  })

  it('transitions to Sleeping when sleep is critical', () => {
    const eid = makeDwarf(world, 10, 10)
    Needs.sleep[eid] = 0.1  // below threshold

    dwarfAISystem(world, map, 0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Sleeping)
  })

  it('triggers tantrum when happiness is very low', () => {
    const eid = makeDwarf(world, 10, 10)
    Mood.happiness[eid] = 0.1  // below 0.15 threshold

    dwarfAISystem(world, map, 0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Tantrum)
    expect(DwarfAI.tantrumTimer[eid]).toBe(100)
  })

  it('skips dead dwarves', () => {
    const eid = makeDwarf(world, 10, 10)
    DwarfAI.state[eid] = DwarfState.Dead
    setTile(5, 5, 0, map, TileType.Stone)
    designateMine(world, map, [{ x: 5, y: 5, z: 0 }])

    dwarfAISystem(world, map, 0)
    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Dead)
  })
})
