import { describe, it, expect, beforeEach } from 'vitest'
import { createGameWorld } from '@core/world'
import type { GameWorld } from '@core/world'
import { createWorld3D, setTile } from '@map/world3d'
import type { World3D } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { Job, JobType, JobState } from '@core/components/job'
import { designateMine, cancelDesignation } from '@systems/mineDesignation'
import { designationStore } from '@core/stores'
import { getAvailableJobs } from '@systems/jobSystem'

describe('mineDesignation system', () => {
  let world: GameWorld
  let map: World3D

  beforeEach(() => {
    world = createGameWorld()
    map = createWorld3D(20, 20, 2)
    designationStore.clear()
    // Fill z=0 with stone
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        setTile(x, y, 0, map, TileType.Stone)
      }
    }
  })

  it('creates a mine job for each designated stone tile', () => {
    designateMine(world, map, [{ x: 3, y: 4, z: 0 }])
    const jobs = getAvailableJobs(world, [JobType.Mine])
    expect(jobs).toHaveLength(1)
    expect(Job.targetX[jobs[0]!]).toBe(3)
    expect(Job.targetY[jobs[0]!]).toBe(4)
    expect(Job.state[jobs[0]!]).toBe(JobState.Available)
  })

  it('skips passable tiles', () => {
    setTile(5, 5, 0, map, TileType.Grass)
    designateMine(world, map, [{ x: 5, y: 5, z: 0 }])
    const jobs = getAvailableJobs(world, [JobType.Mine])
    expect(jobs).toHaveLength(0)
  })

  it('skips already designated tiles', () => {
    designateMine(world, map, [{ x: 2, y: 2, z: 0 }])
    designateMine(world, map, [{ x: 2, y: 2, z: 0 }])  // duplicate
    const jobs = getAvailableJobs(world, [JobType.Mine])
    expect(jobs).toHaveLength(1)
  })

  it('stores designation in designationStore keyed by "x,y,z"', () => {
    designateMine(world, map, [{ x: 1, y: 2, z: 0 }])
    expect(designationStore.has('1,2,0')).toBe(true)
  })

  it('creates designations for multiple tiles', () => {
    const tiles = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ]
    designateMine(world, map, tiles)
    const jobs = getAvailableJobs(world, [JobType.Mine])
    expect(jobs).toHaveLength(3)
  })

  it('job priority is 10', () => {
    designateMine(world, map, [{ x: 3, y: 3, z: 0 }])
    const jobs = getAvailableJobs(world, [JobType.Mine])
    expect(Job.priority[jobs[0]!]).toBe(10)
  })

  describe('cancelDesignation', () => {
    it('removes designation from store', () => {
      designateMine(world, map, [{ x: 5, y: 5, z: 0 }])
      expect(designationStore.has('5,5,0')).toBe(true)
      cancelDesignation(world, 5, 5, 0)
      expect(designationStore.has('5,5,0')).toBe(false)
    })

    it('marks the associated job as cancelled', () => {
      designateMine(world, map, [{ x: 6, y: 6, z: 0 }])
      const jobs = getAvailableJobs(world, [JobType.Mine])
      const jobEid = jobs[0]!
      cancelDesignation(world, 6, 6, 0)
      expect(Job.state[jobEid]).toBe(JobState.Cancelled)
    })

    it('does nothing if no designation at coords', () => {
      expect(() => cancelDesignation(world, 99, 99, 0)).not.toThrow()
    })
  })
})
