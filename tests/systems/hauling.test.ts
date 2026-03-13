import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { Job, JobType, JobState } from '@core/components/job'
import { StockpileCategory } from '@core/components/zone'
import { haulingSystem } from '@systems/haulingSystem'
import { designateStockpile } from '@systems/stockpile'
import { pathStore, pathIndexStore, zoneItemStore } from '@core/stores'
import { getAvailableJobs } from '@systems/jobSystem'

function makeGrassMap(w = 30, h = 30): World3D {
  const map = createWorld3D(w, h, 2)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      setTile(x, y, 0, map, TileType.Grass)
    }
  }
  return map
}

function makeItem(world: GameWorld, type: ItemType, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, Item)
  Item.itemType[eid] = type
  Item.material[eid] = ItemMaterial.Granite
  Item.quality[eid] = 1
  Item.carriedBy[eid] = -1
  Item.x[eid] = x
  Item.y[eid] = y
  Item.z[eid] = 0
  return eid
}

function makeHauler(world: GameWorld, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, DwarfAI)
  addComponent(world, eid, TileCoord)
  TileCoord.x[eid] = x
  TileCoord.y[eid] = y
  TileCoord.z[eid] = 0
  DwarfAI.state[eid] = DwarfState.Idle
  DwarfAI.jobEid[eid] = -1
  return eid
}

describe('haulingSystem', () => {
  let world: GameWorld
  let map: World3D

  beforeEach(() => {
    world = createGameWorld()
    map = makeGrassMap()
    pathStore.clear()
    pathIndexStore.clear()
    zoneItemStore.clear()
  })

  it('creates haul jobs for uncarried items with accepting stockpiles', () => {
    makeItem(world, ItemType.Stone, 5, 5)
    designateStockpile(world, 20, 20, 25, 25, 0, StockpileCategory.Stone)

    haulingSystem(world, map)

    const haulJobs = getAvailableJobs(world, [JobType.Haul])
    expect(haulJobs.length).toBeGreaterThan(0)
    expect(Job.haulItemEid[haulJobs[0]!]).toBeGreaterThanOrEqual(0)
  })

  it('does not create duplicate haul jobs for the same item', () => {
    makeItem(world, ItemType.Stone, 5, 5)
    designateStockpile(world, 20, 20, 25, 25, 0, StockpileCategory.Stone)

    haulingSystem(world, map)
    haulingSystem(world, map)  // call again

    const haulJobs = getAvailableJobs(world, [JobType.Haul])
    expect(haulJobs).toHaveLength(1)
  })

  it('does not create haul jobs when no accepting stockpile', () => {
    makeItem(world, ItemType.Food, 5, 5)
    designateStockpile(world, 20, 20, 25, 25, 0, StockpileCategory.Stone)  // stone only

    haulingSystem(world, map)

    const haulJobs = getAvailableJobs(world, [JobType.Haul])
    expect(haulJobs).toHaveLength(0)
  })

  it('executes haul: dwarf picks up item on arrival', () => {
    const itemEid = makeItem(world, ItemType.Stone, 5, 5)
    designateStockpile(world, 20, 20, 25, 25, 0, StockpileCategory.Stone)

    // Create haul job
    haulingSystem(world, map)

    // Get the haul job and claim it
    const haulJobs = getAvailableJobs(world, [JobType.Haul])
    const jobEid = haulJobs[0]!
    const haulerEid = makeHauler(world, 5, 5)  // already at item location
    DwarfAI.state[haulerEid] = DwarfState.ExecutingJob
    DwarfAI.jobEid[haulerEid] = jobEid
    Job.state[jobEid] = JobState.InProgress
    Job.claimedBy[jobEid] = haulerEid

    haulingSystem(world, map)

    expect(Item.carriedBy[itemEid]).toBe(haulerEid)
  })

  it('deposits item in stockpile when dwarf arrives at destination', () => {
    const itemEid = makeItem(world, ItemType.Stone, 5, 5)
    const zoneEid = designateStockpile(world, 20, 20, 20, 20, 0, StockpileCategory.Stone)

    haulingSystem(world, map)
    const haulJobs = getAvailableJobs(world, [JobType.Haul])
    const jobEid = haulJobs[0]!
    const destX = Job.haulDestX[jobEid] ?? 20
    const destY = Job.haulDestY[jobEid] ?? 20

    // Dwarf is at destination, item is carried
    const haulerEid = makeHauler(world, destX, destY)
    DwarfAI.state[haulerEid] = DwarfState.ExecutingJob
    DwarfAI.jobEid[haulerEid] = jobEid
    Job.state[jobEid] = JobState.InProgress
    Job.claimedBy[jobEid] = haulerEid
    Item.carriedBy[itemEid] = haulerEid

    haulingSystem(world, map)

    expect(Item.carriedBy[itemEid]).toBe(-1)
    expect(Item.x[itemEid]).toBe(destX)
    expect(Item.y[itemEid]).toBe(destY)
    const zoneItems = zoneItemStore.get(zoneEid) ?? new Set()
    expect(zoneItems.has(itemEid)).toBe(true)
    expect(DwarfAI.state[haulerEid] as DwarfState).toBe(DwarfState.Idle)
  })
})
