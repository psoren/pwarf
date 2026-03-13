/**
 * Side stores for non-numeric entity data.
 * Keys are always entity IDs (numbers).
 * Clean up entries when entities are removed (use observe + onRemove).
 */

import type { Coord3 } from '@systems/pathfinding'

export const nameStore = new Map<number, string>()
export const inventoryStore = new Map<number, number[]>()  // eid → [item eids]
export const pathStore = new Map<number, Coord3[]>()       // eid → [waypoints along path]
export const pathIndexStore = new Map<number, number>()    // eid → current waypoint index

export const zoneItemStore = new Map<number, Set<number>>()  // zoneEid → Set<itemEid>

export const designationStore = new Map<string, number>()  // "x,y,z" → designationEid

/**
 * A thought entry stored in the thought store.
 */
export type ThoughtEntry = {
  description: string
  moodDelta: number
  tick: number
}

export const thoughtStore = new Map<number, ThoughtEntry[]>()

/**
 * Add a thought to the thought store for an entity.
 * Keeps only the most recent 20 thoughts.
 */
export function addThought(eid: number, description: string, moodDelta: number, currentTick: number): void {
  const list = thoughtStore.get(eid) ?? []
  list.push({ description, moodDelta, tick: currentTick })
  thoughtStore.set(eid, list.length > 20 ? list.slice(-20) : list)
}
