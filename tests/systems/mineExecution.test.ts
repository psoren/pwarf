import { describe, it, expect, beforeEach } from 'vitest'
import { addEntity, addComponent, query } from 'bitecs'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile, getTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { DwarfAI, DwarfState, Skills } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Job, JobType, JobState } from '@core/components/job'
import { Item, ItemType } from '@core/components/item'
import { mineExecutionSystem } from '@systems/mineExecutionSystem'
import { pathStore, designationStore } from '@core/stores'
import { designateMine } from '@systems/mineDesignation'
import { MINING_TICKS } from '@core/constants'

function makeMiner(world: GameWorld, x: number, y: number): number {
  const eid = addEntity(world)
  addComponent(world, eid, TileCoord)
  addComponent(world, eid, DwarfAI)
  addComponent(world, eid, Skills)
  TileCoord.x[eid] = x
  TileCoord.y[eid] = y
  TileCoord.z[eid] = 0
  DwarfAI.state[eid] = DwarfState.ExecutingJob
  DwarfAI.jobEid[eid] = -1
  return eid
}

describe('mineExecutionSystem', () => {
  let world: GameWorld
  let map: World3D

  beforeEach(() => {
    world = createGameWorld()
    map = createWorld3D(20, 20, 2)
    designationStore.clear()
    pathStore.clear()
    // Fill surface with grass, leave (5,5) as stone for mining
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        setTile(x, y, 0, map, TileType.Grass)
      }
    }
    setTile(5, 5, 0, map, TileType.Stone)
  })

  it('advances job progress when dwarf is adjacent to target', () => {
    const eid = makeMiner(world, 4, 5)  // adjacent to (5,5)
    // Create a mine job
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    expect(Job.progress[jobEid]).toBeGreaterThan(0)
  })

  it('converts stone to floor when progress reaches 1.0', () => {
    const eid = makeMiner(world, 4, 5)
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0.99  // just under 1.0
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    // Should have pushed progress over 1.0
    expect(getTile(5, 5, 0, map)).toBe(TileType.Floor)
  })

  it('drops a stone item when tile is mined', () => {
    const eid = makeMiner(world, 4, 5)
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0.99
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    const items = query(world, [Item])
    const stoneItems = items.filter(ieid =>
      (Item.itemType[ieid] as ItemType) === ItemType.Stone &&
      (Item.x[ieid] ?? -1) === 5 &&
      (Item.y[ieid] ?? -1) === 5,
    )
    expect(stoneItems.length).toBeGreaterThan(0)
  })

  it('sets dwarf state to Idle and clears jobEid after completing mine', () => {
    const eid = makeMiner(world, 4, 5)
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0.99
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    expect(DwarfAI.state[eid] as DwarfState).toBe(DwarfState.Idle)
    expect(DwarfAI.jobEid[eid]).toBe(-1)
  })

  it('does not advance when dwarf is not adjacent to target', () => {
    const eid = makeMiner(world, 10, 10)  // far from (5,5)
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    expect(Job.progress[jobEid]).toBe(0)
  })

  it('removes designation from store when tile is mined', () => {
    designateMine(world, map, [{ x: 5, y: 5, z: 0 }])
    expect(designationStore.has('5,5,0')).toBe(true)

    const eid = makeMiner(world, 4, 5)
    // Find the actual job from designation
    const jobs = query(world, [Job])
    const jobEid = jobs.find(j => (Job.targetX[j] ?? -1) === 5 && (Job.targetY[j] ?? -1) === 5)!
    Job.state[jobEid] = JobState.InProgress
    Job.progress[jobEid] = 0.99
    DwarfAI.jobEid[eid] = jobEid

    mineExecutionSystem(world, map)

    expect(designationStore.has('5,5,0')).toBe(false)
  })

  it('completes mining within MINING_TICKS + 2 ticks with skill=0', () => {
    const eid = makeMiner(world, 4, 5)
    Skills.mining[eid] = 0
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.InProgress
    Job.targetX[jobEid] = 5
    Job.targetY[jobEid] = 5
    Job.targetZ[jobEid] = 0
    Job.progress[jobEid] = 0
    DwarfAI.jobEid[eid] = jobEid

    // Should not be done after just a few ticks
    for (let t = 0; t < 5; t++) {
      mineExecutionSystem(world, map)
    }
    expect(getTile(5, 5, 0, map)).toBe(TileType.Stone)

    // Should complete within MINING_TICKS + 2 total ticks
    for (let t = 5; t < MINING_TICKS + 2; t++) {
      mineExecutionSystem(world, map)
    }
    expect(getTile(5, 5, 0, map)).toBe(TileType.Floor)
  })
})
