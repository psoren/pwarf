/**
 * Side stores for non-numeric entity data.
 * Keys are always entity IDs (numbers).
 * Clean up entries when entities are removed (use observe + onRemove).
 */

export const nameStore = new Map<number, string>()
export const inventoryStore = new Map<number, number[]>()  // eid → [item eids]
export const pathStore = new Map<number, number[]>()       // eid → [tile indices along path]
