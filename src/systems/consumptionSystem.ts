import { query, removeEntity } from 'bitecs'
import type { GameWorld } from '@core/world'
import type { World3D } from '@map/world3d'
import { DwarfAI, DwarfState, Needs } from '@core/components/dwarf'
import { TileCoord } from '@core/components/tileCoord'
import { Item, ItemType } from '@core/components/item'
import { pathStore, pathIndexStore, addThought } from '@core/stores'
import { findPath } from '@systems/pathfinding'

function storageZOf(eid: number): number {
  return Math.abs(TileCoord.z[eid] ?? 0)
}

function findNearestItemOfType(
  world: GameWorld,
  x: number,
  y: number,
  itemType: ItemType,
): number | null {
  const items = query(world, [Item])
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < items.length; i++) {
    const itemEid = items[i]!
    if ((Item.itemType[itemEid] as ItemType) !== itemType) continue
    if ((Item.carriedBy[itemEid] ?? -1) !== -1) continue
    const dist = Math.abs((Item.x[itemEid] ?? 0) - x) + Math.abs((Item.y[itemEid] ?? 0) - y)
    if (dist < bestDist) {
      bestDist = dist
      best = itemEid
    }
  }
  return best >= 0 ? best : null
}

/**
 * System that handles dwarves in Eating or Drinking states.
 * Finds food/drink items, paths to them, and consumes them on arrival.
 */
export function consumptionSystem(world: GameWorld, map: World3D, currentTick: number): void {
  const entities = query(world, [DwarfAI, Needs, TileCoord])
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i]!
    const state = DwarfAI.state[eid] as DwarfState
    if (state !== DwarfState.Eating && state !== DwarfState.Drinking) continue

    const isEating = state === DwarfState.Eating
    const targetType = isEating ? ItemType.Food : ItemType.Drink

    // Get/validate current target
    let targetEid = isEating
      ? (DwarfAI.eatTargetEid[eid] ?? -1)
      : (DwarfAI.drinkTargetEid[eid] ?? -1)

    // Invalidate target if it's been taken by another dwarf
    if (
      targetEid >= 0 &&
      (Item.carriedBy[targetEid] ?? -1) !== -1 &&
      (Item.carriedBy[targetEid] ?? -1) !== eid
    ) {
      targetEid = -1
    }

    if (targetEid < 0) {
      // Find nearest unclaimed item
      targetEid = findNearestItemOfType(
        world,
        TileCoord.x[eid] ?? 0,
        TileCoord.y[eid] ?? 0,
        targetType,
      ) ?? -1

      if (isEating) {
        DwarfAI.eatTargetEid[eid] = targetEid
      } else {
        DwarfAI.drinkTargetEid[eid] = targetEid
      }
      pathStore.delete(eid)  // reset path
    }

    if (targetEid < 0) {
      // No food/drink anywhere — stay in state
      continue
    }

    // Path to item if needed
    if (!pathStore.has(eid)) {
      const from = {
        x: TileCoord.x[eid] ?? 0,
        y: TileCoord.y[eid] ?? 0,
        z: storageZOf(eid),
      }
      const to = {
        x: Item.x[targetEid] ?? 0,
        y: Item.y[targetEid] ?? 0,
        z: Item.z[targetEid] ?? 0,
      }
      if (from.x !== to.x || from.y !== to.y) {
        const path = findPath(map, from, to)
        if (path && path.length > 0) {
          pathStore.set(eid, path)
          pathIndexStore.set(eid, 0)
        }
      }
    }

    // Check if arrived at item
    const atItem =
      (TileCoord.x[eid] ?? 0) === (Item.x[targetEid] ?? 0) &&
      (TileCoord.y[eid] ?? 0) === (Item.y[targetEid] ?? 0) &&
      !pathStore.has(eid)

    if (atItem) {
      if (isEating) {
        Needs.hunger[eid] = 1.0
        DwarfAI.eatTargetEid[eid] = -1
        addThought(eid, 'ate a meal', 0.05, currentTick)
      } else {
        Needs.thirst[eid] = 1.0
        DwarfAI.drinkTargetEid[eid] = -1
        addThought(eid, 'had a drink', 0.05, currentTick)
      }
      removeEntity(world, targetEid)
      DwarfAI.state[eid] = DwarfState.Idle
    }
  }
}
