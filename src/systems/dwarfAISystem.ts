import { query, hasComponent } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { getTile } from '@map/world3d'
import { DwarfAI, DwarfState, Needs, Labor, LaborType } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Position } from '@core/components/position'
import { Mood } from '@core/components/mood'
import { Item, ItemType } from '@core/components/item'
import { Job, JobType, JobState } from '@core/components/job'
import { pathStore, pathIndexStore } from '@core/stores'
import { claimJob, releaseJob, getAvailableJobs } from '@systems/jobSystem'
import { findPath, isTilePassable } from '@systems/pathfinding'
import type { Coord3 } from '@systems/pathfinding'
import { NEEDS_CRITICAL_THRESHOLD } from '@core/constants'

function storageZOf(eid: number): number {
  return Math.abs(TileCoord.z[eid] ?? 0)
}

function findAdjacentPassable(
  map: World3D,
  tx: number,
  ty: number,
  tz: number,
): Coord3 | null {
  const neighbors: Coord3[] = [
    { x: tx - 1, y: ty,     z: tz },
    { x: tx + 1, y: ty,     z: tz },
    { x: tx,     y: ty - 1, z: tz },
    { x: tx,     y: ty + 1, z: tz },
  ]
  for (const n of neighbors) {
    if (n.x < 0 || n.x >= map.width || n.y < 0 || n.y >= map.height) continue
    if (isTilePassable(getTile(n.x, n.y, n.z, map))) return n
  }
  return null
}

function findFoodItem(world: GameWorld): number | null {
  const items = query(world, [Item])
  for (let i = 0; i < items.length; i++) {
    const eid = items[i]!
    if ((Item.itemType[eid] as ItemType) === ItemType.Food && (Item.carriedBy[eid] ?? -1) === -1) {
      return eid
    }
  }
  return null
}

function findDrinkItem(world: GameWorld): number | null {
  const items = query(world, [Item])
  for (let i = 0; i < items.length; i++) {
    const eid = items[i]!
    if ((Item.itemType[eid] as ItemType) === ItemType.Drink && (Item.carriedBy[eid] ?? -1) === -1) {
      return eid
    }
  }
  return null
}

function tryClaimMineJob(
  world: GameWorld,
  dwarfEid: number,
  map: World3D,
  dwarfTile: Coord3,
): boolean {
  const jobs = getAvailableJobs(world, [JobType.Mine])
  for (const jobEid of jobs) {
    const tx = Job.targetX[jobEid] ?? 0
    const ty = Job.targetY[jobEid] ?? 0
    const tz = (Job.targetZ[jobEid] ?? 0) as number

    // Find a passable adjacent tile to stand on while mining
    const adj = findAdjacentPassable(map, tx, ty, tz)
    if (!adj) continue

    const path = findPath(map, dwarfTile, adj)
    if (!path) continue

    claimJob(world, dwarfEid, jobEid)
    DwarfAI.jobEid[dwarfEid] = jobEid
    pathStore.set(dwarfEid, path)
    pathIndexStore.set(dwarfEid, 0)
    return true
  }
  return false
}

function tryClaimHaulJob(
  world: GameWorld,
  dwarfEid: number,
  map: World3D,
  dwarfTile: Coord3,
): boolean {
  const jobs = getAvailableJobs(world, [JobType.Haul])
  for (const jobEid of jobs) {
    const tx = Job.targetX[jobEid] ?? 0
    const ty = Job.targetY[jobEid] ?? 0
    const tz = (Job.targetZ[jobEid] ?? 0) as number

    const path = findPath(map, dwarfTile, { x: tx, y: ty, z: tz })
    if (!path) continue

    claimJob(world, dwarfEid, jobEid)
    DwarfAI.jobEid[dwarfEid] = jobEid
    pathStore.set(dwarfEid, path)
    pathIndexStore.set(dwarfEid, 0)
    return true
  }
  return false
}

/**
 * Main dwarf AI state machine. Runs each tick per dwarf.
 */
export function dwarfAISystem(world: GameWorld, map: World3D, _currentTick: number): void {
  const entities = query(world, [DwarfAI, Needs, Position, TileCoord, Labor])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    const state = DwarfAI.state[eid] as DwarfState
    if (state === DwarfState.Dead) continue

    switch (state) {
      case DwarfState.Idle: {
        // Check critical needs
        if ((Needs.hunger[eid] ?? 1) < NEEDS_CRITICAL_THRESHOLD) {
          if (findFoodItem(world) !== null) {
            DwarfAI.state[eid] = DwarfState.Eating
            DwarfAI.eatTargetEid[eid] = -1
            break
          }
        }
        if ((Needs.thirst[eid] ?? 1) < NEEDS_CRITICAL_THRESHOLD) {
          if (findDrinkItem(world) !== null) {
            DwarfAI.state[eid] = DwarfState.Drinking
            DwarfAI.drinkTargetEid[eid] = -1
            break
          }
        }
        if ((Needs.sleep[eid] ?? 1) < NEEDS_CRITICAL_THRESHOLD) {
          DwarfAI.state[eid] = DwarfState.Sleeping
          break
        }
        // Check for available jobs
        const mineJobs = getAvailableJobs(world, [JobType.Mine])
        const haulJobs = getAvailableJobs(world, [JobType.Haul])
        const hasMineLbr = (Labor.enabled[eid] ?? 0) & LaborType.Mining
        const hasHaulLbr = (Labor.enabled[eid] ?? 0) & LaborType.Hauling
        if ((mineJobs.length > 0 && hasMineLbr) || (haulJobs.length > 0 && hasHaulLbr)) {
          DwarfAI.state[eid] = DwarfState.SeekingJob
        }
        break
      }

      case DwarfState.SeekingJob: {
        const dwarfTile: Coord3 = {
          x: TileCoord.x[eid] ?? 0,
          y: TileCoord.y[eid] ?? 0,
          z: storageZOf(eid),
        }
        let claimed = false

        // Try mine jobs first
        if ((Labor.enabled[eid] ?? 0) & LaborType.Mining) {
          claimed = tryClaimMineJob(world, eid, map, dwarfTile)
        }

        // Try haul jobs
        if (!claimed && ((Labor.enabled[eid] ?? 0) & LaborType.Hauling)) {
          claimed = tryClaimHaulJob(world, eid, map, dwarfTile)
        }

        DwarfAI.state[eid] = claimed ? DwarfState.ExecutingJob : DwarfState.Idle
        break
      }

      case DwarfState.ExecutingJob: {
        // Abandon job for critical need
        if (
          (Needs.hunger[eid] ?? 1) < NEEDS_CRITICAL_THRESHOLD / 2 ||
          (Needs.thirst[eid] ?? 1) < NEEDS_CRITICAL_THRESHOLD / 2
        ) {
          const jobEid = DwarfAI.jobEid[eid] ?? -1
          if (jobEid >= 0) releaseJob(world, jobEid)
          DwarfAI.jobEid[eid] = -1
          pathStore.delete(eid)
          pathIndexStore.delete(eid)
          DwarfAI.state[eid] = DwarfState.Idle
          break
        }

        const jobEid = DwarfAI.jobEid[eid] ?? -1
        if (
          jobEid < 0 ||
          (Job.state[jobEid] as JobState) === JobState.Complete ||
          (Job.state[jobEid] as JobState) === JobState.Cancelled
        ) {
          DwarfAI.jobEid[eid] = -1
          DwarfAI.state[eid] = DwarfState.Idle
        }
        break
      }

      case DwarfState.Eating:
      case DwarfState.Drinking:
      case DwarfState.Sleeping:
      case DwarfState.Tantrum:
        // Handled by dedicated systems
        break
    }

    // Tantrum trigger: low happiness snaps dwarf into tantrum
    if (
      hasComponent(world, eid, Mood) &&
      (Mood.happiness[eid] ?? 1) < 0.15 &&
      (DwarfAI.state[eid] as DwarfState) !== DwarfState.Tantrum &&
      (DwarfAI.state[eid] as DwarfState) !== DwarfState.Dead
    ) {
      DwarfAI.state[eid] = DwarfState.Tantrum
      DwarfAI.tantrumTimer[eid] = 100
    }
  }
}
