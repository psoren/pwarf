import { DWARF_CARRY_CAPACITY } from "@pwarf/shared";
import type { Dwarf, Item } from "@pwarf/shared";
import type { CachedState } from "./sim-context.js";

/** Get all items carried by a dwarf. */
export function getCarriedItems(dwarfId: string, items: Item[]): Item[] {
  return items.filter(i => i.held_by_dwarf_id === dwarfId);
}

/** Get total weight of items carried by a dwarf. */
export function getCarriedWeight(dwarfId: string, items: Item[]): number {
  let total = 0;
  for (const item of items) {
    if (item.held_by_dwarf_id === dwarfId) {
      total += item.weight ?? 0;
    }
  }
  return total;
}

/** Check if a dwarf can pick up an item without exceeding carry capacity. */
export function canPickUp(dwarfId: string, item: Item, items: Item[]): boolean {
  const currentWeight = getCarriedWeight(dwarfId, items);
  return currentWeight + (item.weight ?? 0) <= DWARF_CARRY_CAPACITY;
}

/** Pick up an item — set held_by_dwarf_id, clear world position. */
export function pickUpItem(dwarf: Dwarf, item: Item, state: CachedState): void {
  item.held_by_dwarf_id = dwarf.id;
  item.position_x = null;
  item.position_y = null;
  item.position_z = null;
  state.dirtyItemIds.add(item.id);
}

/** Drop an item at the dwarf's current position. */
export function dropItem(dwarf: Dwarf, item: Item, state: CachedState): void {
  item.held_by_dwarf_id = null;
  item.position_x = dwarf.position_x;
  item.position_y = dwarf.position_y;
  item.position_z = dwarf.position_z;
  state.dirtyItemIds.add(item.id);
}
