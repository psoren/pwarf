import { addEntity, addComponent, removeEntity } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { getTile } from '@map/world3d'
import { Designation, DesignationType } from '@core/components/designation'
import { Job, JobType, JobState } from '@core/components/job'
import { designationStore } from '@core/stores'
import { isTilePassable } from '@systems/pathfinding'

/**
 * Designate a set of tiles for mining. For each non-passable tile, create a
 * Designation entity and a corresponding Mine job entity.
 */
export function designateMine(
  world: GameWorld,
  map: World3D,
  tiles: { x: number; y: number; z: number }[],
): void {
  for (const tile of tiles) {
    const key = `${tile.x},${tile.y},${tile.z}`
    if (designationStore.has(key)) continue  // already designated

    const tileType = getTile(tile.x, tile.y, tile.z, map)
    if (isTilePassable(tileType)) continue  // can't mine passable tiles

    const desEid = addEntity(world)
    addComponent(world, desEid, Designation)
    Designation.desType[desEid] = DesignationType.Mine
    Designation.tileX[desEid] = tile.x
    Designation.tileY[desEid] = tile.y
    Designation.tileZ[desEid] = tile.z

    // Create corresponding mine job
    const jobEid = addEntity(world)
    addComponent(world, jobEid, Job)
    Job.jobType[jobEid] = JobType.Mine
    Job.state[jobEid] = JobState.Available
    Job.claimedBy[jobEid] = -1
    Job.targetX[jobEid] = tile.x
    Job.targetY[jobEid] = tile.y
    Job.targetZ[jobEid] = tile.z
    Job.priority[jobEid] = 10
    Job.progress[jobEid] = 0

    Designation.jobEid[desEid] = jobEid
    designationStore.set(key, desEid)
  }
}

/**
 * Cancel a mine designation at the given tile coords.
 */
export function cancelDesignation(
  world: GameWorld,
  x: number,
  y: number,
  z: number,
): void {
  const key = `${x},${y},${z}`
  const desEid = designationStore.get(key)
  if (desEid === undefined) return

  const jobEid = Designation.jobEid[desEid] ?? -1
  if (jobEid >= 0) {
    Job.state[jobEid] = JobState.Cancelled
  }

  designationStore.delete(key)
  removeEntity(world, desEid)
}
