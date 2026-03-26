# 15 — Hauling and Stockpiles

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

The hauling system moves loose items from the ground into organized stockpiles. It works alongside the inventory system (item carrying/dropping) and the resource check system (material consumption for building). Together they form the item logistics layer of the sim.

## Files

| File | Role |
|---|---|
| `sim/src/phases/haul-assignment.ts` | Creates haul tasks for loose items and carrying dwarves |
| `sim/src/inventory.ts` | Item pickup, drop, carry weight helpers |
| `sim/src/resource-check.ts` | Resource availability checks and consumption for build tasks |

## Haul Assignment Phase

The `haulAssignment` phase runs every tick and operates in two passes.

### Phase 1: Dwarves Already Carrying Items

For each idle dwarf currently holding items:

1. If no stockpiles exist at all, drop items on the ground (dwarf is not stuck).
2. Find the best stockpile tile for the first carried item.
3. If a valid stockpile is found, create a `haul` task targeting that tile.
4. If no valid stockpile accepts the item, drop all carried items.

### Phase 2: Ground Items Not on Stockpiles

For each item on the ground that is not already on a stockpile tile:

1. Skip items already targeted by a pending/active haul task (prevents duplicate hauling).
2. Find the best stockpile tile for the item.
3. If found, create a `haul` task.

### Duplicate Prevention

A `Set<string>` tracks all item IDs that already have a non-completed haul task. Both phases check this set before creating new tasks. Items added during the current tick's Phase 1 are also tracked so Phase 2 does not duplicate them.

## Stockpile Selection

`findBestStockpile` selects the optimal tile using a priority cascade:

1. **Category filter** — Only tiles whose `accepts_categories` includes the item's category (or `null`/undefined, meaning accept all).
2. **Capacity check** — Skip tiles at `STOCKPILE_TILE_CAPACITY = 3` items. Capacity counts both items physically on the tile and items targeted by pending haul tasks.
3. **Priority** — Among valid tiles, prefer the highest `priority` value.
4. **Distance** — Break ties by nearest Manhattan distance from the item/dwarf.

Returns `null` if no valid tile exists.

## Inventory System

The inventory module provides low-level item manipulation:

| Function | Purpose |
|---|---|
| `getCarriedItems(dwarfId, items)` | Returns all items held by a dwarf |
| `getCarriedWeight(dwarfId, items)` | Sum of `weight` for held items |
| `canPickUp(dwarfId, item, items)` | Check against `DWARF_CARRY_CAPACITY = 50` |
| `pickUpItem(dwarf, item, state)` | Set `held_by_dwarf_id`, clear world position, mark dirty |
| `dropItem(dwarf, item, state)` | Clear `held_by_dwarf_id`, set position to dwarf's location, mark dirty |

Items exist in one of two states:
- **On ground**: `held_by_dwarf_id = null`, `position_x/y/z` set
- **Carried**: `held_by_dwarf_id` set, `position_x/y/z = null`

## Resource Check

The `resource-check` module verifies and consumes materials for build tasks. It uses `BUILDING_COSTS` (defined in `shared/src/constants.ts`) which maps task types to arrays of `{ category, material, count }` requirements.

### Two-Pass Verify-Then-Consume

`consumeResources(taskType, ctx, builderId?)`:

1. **Verify pass** — Count available items matching each cost's category and material. If any cost cannot be met, return `false` (nothing consumed).
2. **Consume pass** — Remove items from `state.items`. Prefers ground items first, then falls back to the builder's held items.

The `builderId` parameter solves a deadlock: when a dwarf mines stone and immediately needs it to build a wall, the stone is in their inventory, not on the ground. Without `builderId`, the resource check would fail.

### Availability Check

`hasResources(taskType, items, civId, includeDwarfId?)` is a read-only check used by the UI and task creation to show whether a build is affordable. Same logic as the verify pass but does not consume.

`countAvailableItems(items, civId, category, material, includeDwarfId?)` counts matching items in a civilization. Items must not be held by another dwarf (unless that dwarf is `includeDwarfId`).

## Constants

```typescript
WORK_HAUL = 10
STOCKPILE_TILE_CAPACITY = 3
DWARF_CARRY_CAPACITY = 50
```

## Item Flow

```
Mining / Foraging / Crafting
         │
         v
   Item on ground
         │
    ┌────┴─────────────────────┐
    │                          │
    v                          v
 Haul Assignment          Build Task
 (idle dwarf picks up,    (consumeResources
  carries to stockpile)    removes from ground
    │                      or builder inventory)
    v
 Stockpile tile
 (organized, up to 3 per tile)
```
