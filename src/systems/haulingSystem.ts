import { query, addEntity, addComponent } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { DwarfAI, DwarfState } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Item, ItemType } from '@core/components/item'
import { Job, JobType, JobState } from '@core/components/job'
import { pathStore, pathIndexStore, zoneItemStore } from '@core/stores'
import { completeJob } from '@systems/jobSystem'
import { findPath } from '@systems/pathfinding'
import { findAcceptingStockpile, getOpenStockpileTile } from '@systems/stockpile'

function storageZOf(eid: number): number {
  return Math.abs(TileCoord.z[eid] ?? 0)
}

function haulJobExistsForItem(world: GameWorld, itemEid: number): boolean {
  const jobs = query(world, [Job])
  for (let i = 0; i < jobs.length; i++) {
    const jeid = jobs[i]!
    if (
      (Job.haulItemEid[jeid] ?? -1) === itemEid &&
      (Job.state[jeid] as JobState) !== JobState.Complete &&
      (Job.state[jeid] as JobState) !== JobState.Cancelled
    ) {
      return true
    }
  }
  return false
}

function createHaulJobs(world: GameWorld): void {
  const items = query(world, [Item])
  for (let i = 0; i < items.length; i++) {
    const itemEid = items[i]!
    if ((Item.carriedBy[itemEid] ?? -1) !== -1) continue  // already carried
    if (haulJobExistsForItem(world, itemEid)) continue

    const zoneEid = findAcceptingStockpile(world, Item.itemType[itemEid] as ItemType)
    if (zoneEid === null) continue

    const dest = getOpenStockpileTile(world, zoneEid)
    if (!dest) continue

    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Haul
    Job.state[jobEid] = JobState.Available
    Job.claimedBy[jobEid] = -1
    Job.targetX[jobEid] = Item.x[itemEid] ?? 0
    Job.targetY[jobEid] = Item.y[itemEid] ?? 0
    Job.targetZ[jobEid] = Item.z[itemEid] ?? 0
    Job.priority[jobEid] = 5
    Job.haulItemEid[jobEid] = itemEid
    Job.haulDestX[jobEid] = dest.x
    Job.haulDestY[jobEid] = dest.y
    Job.haulDestZ[jobEid] = dest.z
    Job.haulZoneEid[jobEid] = zoneEid
  }
}

function executeHaulJobs(world: GameWorld, map: World3D): void {
  const entities = query(world, [DwarfAI, TileCoord])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) !== DwarfState.ExecutingJob) continue

    const jobEid = DwarfAI.jobEid[eid] ?? -1
    if (jobEid < 0) continue
    if ((Job.jobType[jobEid] as JobType) !== JobType.Haul) continue

    const itemEid = Job.haulItemEid[jobEid] ?? -1
    if (itemEid < 0) continue

    const itemCarried = (Item.carriedBy[itemEid] ?? -1) === eid

    if (!itemCarried) {
      // Phase: walk to item location
      const arrivedAtItem =
        !pathStore.has(eid) &&
        (TileCoord.x[eid] ?? 0) === (Item.x[itemEid] ?? 0) &&
        (TileCoord.y[eid] ?? 0) === (Item.y[itemEid] ?? 0)

      if (arrivedAtItem) {
        Item.carriedBy[itemEid] = eid
        // Now path to destination
        const dest = {
          x: Job.haulDestX[jobEid] ?? 0,
          y: Job.haulDestY[jobEid] ?? 0,
          z: Job.haulDestZ[jobEid] ?? 0,
        }
        const from = {
          x: TileCoord.x[eid] ?? 0,
          y: TileCoord.y[eid] ?? 0,
          z: storageZOf(eid),
        }
        const path = findPath(map, from, dest)
        if (path && path.length > 0) {
          pathStore.set(eid, path)
          pathIndexStore.set(eid, 0)
        }
      }
    } else {
      // Phase: walk to stockpile destination
      const destX = Job.haulDestX[jobEid] ?? 0
      const destY = Job.haulDestY[jobEid] ?? 0

      const arrivedAtDest =
        !pathStore.has(eid) &&
        (TileCoord.x[eid] ?? 0) === destX &&
        (TileCoord.y[eid] ?? 0) === destY

      if (arrivedAtDest) {
        Item.carriedBy[itemEid] = -1
        Item.x[itemEid] = destX
        Item.y[itemEid] = destY

        const zoneEid = Job.haulZoneEid[jobEid] ?? -1
        if (zoneEid >= 0) {
          const set = zoneItemStore.get(zoneEid) ?? new Set<number>()
          set.add(itemEid)
          zoneItemStore.set(zoneEid, set)
        }

        completeJob(world, jobEid)
        DwarfAI.jobEid[eid] = -1
        DwarfAI.state[eid] = DwarfState.Idle
      }

      // Update carried item position to follow dwarf
      Item.x[itemEid] = TileCoord.x[eid] ?? 0
      Item.y[itemEid] = TileCoord.y[eid] ?? 0
    }
  }
}

/**
 * Hauling system: creates haul jobs for items near stockpiles, and
 * executes haul jobs (pick up item, walk to stockpile, deposit).
 */
export function haulingSystem(world: GameWorld, map: World3D): void {
  createHaulJobs(world)
  executeHaulJobs(world, map)
}
