import { query, addEntity, addComponent } from 'bitecs'
import type { GameWorld } from '@core/world'
import { Patch } from '@core/components/patch'
import { Item, ItemType, ItemMaterial } from '@core/components/item'

/**
 * Each tick, decrement patch timers and spawn a new food/drink item
 * when a patch timer hits zero.
 */
export function patchGrowthSystem(world: GameWorld): void {
  const patches = query(world, [Patch])
  for (let i = 0; i < patches.length; i++) {
    const eid = patches[i]!
    Patch.timer[eid] = (Patch.timer[eid] ?? 1) - 1
    if ((Patch.timer[eid] ?? 0) > 0) continue

    Patch.timer[eid] = Patch.interval[eid] ?? 200

    const itemEid = addEntity(world)
    addComponent(world, itemEid, Item)
    Item.itemType[itemEid]  = Patch.itemType[eid] ?? ItemType.Food
    Item.material[itemEid]  = (Patch.itemType[eid] as ItemType) === ItemType.Food
      ? ItemMaterial.Plump
      : ItemMaterial.None
    Item.quality[itemEid]   = 1
    Item.carriedBy[itemEid] = -1
    Item.x[itemEid] = Patch.x[eid] ?? 0
    Item.y[itemEid] = Patch.y[eid] ?? 0
    Item.z[itemEid] = Patch.z[eid] ?? 0
  }
}
