import { query, addEntity, addComponent, removeEntity } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { getTile, setTile, getMaterial } from '@map/world3d'
import { TileType } from '@map/tileTypes'
import { StoneMaterial, OreMaterial } from '@map/materials'
import { DwarfAI, DwarfState, Skills } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Job, JobType } from '@core/components/job'
import { Item, ItemType, ItemMaterial } from '@core/components/item'
import { pathStore, designationStore } from '@core/stores'
import { completeJob } from '@systems/jobSystem'
import { MINING_TICKS } from '@core/constants'

function storageZOf(eid: number): number {
  return Math.abs(TileCoord.z[eid] ?? 0)
}

function stoneMaterialToItemMaterial(mat: number): ItemMaterial {
  const mapping: Record<number, ItemMaterial> = {
    [StoneMaterial.Granite]:   ItemMaterial.Granite,
    [StoneMaterial.Limestone]: ItemMaterial.Limestone,
    [StoneMaterial.Sandstone]: ItemMaterial.Sandstone,
    [StoneMaterial.Basalt]:    ItemMaterial.Basalt,
    [StoneMaterial.Marble]:    ItemMaterial.Marble,
  }
  return mapping[mat] ?? ItemMaterial.Granite
}

function oreMaterialToItemMaterial(mat: number): ItemMaterial {
  const mapping: Record<number, ItemMaterial> = {
    [OreMaterial.Iron]:       ItemMaterial.IronOre,
    [OreMaterial.Copper]:     ItemMaterial.CopperOre,
    [OreMaterial.Coal]:       ItemMaterial.CoalOre,
    [OreMaterial.Gold]:       ItemMaterial.GoldOre,
    [OreMaterial.Adamantine]: ItemMaterial.AdamantineOre,
  }
  return mapping[mat] ?? ItemMaterial.IronOre
}

/**
 * System that advances mining progress for dwarves executing mine jobs,
 * and completes mining when progress reaches 1.0.
 */
export function mineExecutionSystem(world: GameWorld, map: World3D): void {
  const entities = query(world, [DwarfAI, TileCoord, Skills])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    if ((DwarfAI.state[eid] as DwarfState) !== DwarfState.ExecutingJob) continue

    const jobEid = DwarfAI.jobEid[eid] ?? -1
    if (jobEid < 0) continue
    if ((Job.jobType[jobEid] as JobType) !== JobType.Mine) continue

    const tx = Job.targetX[jobEid] ?? 0
    const ty = Job.targetY[jobEid] ?? 0
    const tz = (Job.targetZ[jobEid] ?? 0) as number

    const dx = TileCoord.x[eid] ?? 0
    const dy = TileCoord.y[eid] ?? 0
    const isAdjacent =
      Math.abs(dx - tx) + Math.abs(dy - ty) === 1 && storageZOf(eid) === tz
    const arrived = isAdjacent && !pathStore.has(eid)

    if (!arrived) continue

    // Advance progress
    const skillBonus = 1 + ((Skills.mining[eid] ?? 0) / 20)
    Job.progress[jobEid] = (Job.progress[jobEid] ?? 0) + skillBonus / MINING_TICKS

    if ((Job.progress[jobEid] ?? 0) >= 1.0) {
      const tileType = getTile(tx, ty, tz, map)
      const mat = getMaterial(tx, ty, tz, map)

      // Excavate the tile
      setTile(tx, ty, tz, map, TileType.Floor)

      // Drop stone item
      const stoneEid = addEntity(world)
      addComponent(world, stoneEid, Item)
      Item.itemType[stoneEid] = ItemType.Stone
      Item.material[stoneEid] = stoneMaterialToItemMaterial(mat)
      Item.quality[stoneEid] = 1
      Item.carriedBy[stoneEid] = -1
      Item.x[stoneEid] = tx
      Item.y[stoneEid] = ty
      Item.z[stoneEid] = tz

      // If ore tile, also drop an ore item
      if (tileType === TileType.Ore) {
        const oreEid = addEntity(world)
        addComponent(world, oreEid, Item)
        Item.itemType[oreEid] = ItemType.Ore
        Item.material[oreEid] = oreMaterialToItemMaterial(mat)
        Item.quality[oreEid] = 1
        Item.carriedBy[oreEid] = -1
        Item.x[oreEid] = tx
        Item.y[oreEid] = ty
        Item.z[oreEid] = tz
      }

      // Remove the designation for this tile
      const key = `${tx},${ty},${tz}`
      const desEid = designationStore.get(key)
      if (desEid !== undefined) {
        designationStore.delete(key)
        removeEntity(world, desEid)
      }

      completeJob(world, jobEid)
      DwarfAI.jobEid[eid] = -1
      DwarfAI.state[eid] = DwarfState.Idle
    }
  }
}
