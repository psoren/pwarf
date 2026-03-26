# 13 — Workshop System

> **Status:** Design only
> **Last verified:** 2026-03-25

## Problem

Crafting tasks (brew, cook, smith) happen anywhere — there's no physical structure requirement. This removes spatial gameplay, hauling logistics, and placement decisions. In Dwarf Fortress, workshop placement and stockpile proximity are the core optimization puzzle. We have none of that.

## Design

Workshops are 1-tile buildable structures. Crafting tasks require a workshop of the correct type. The dwarf walks to the workshop, ingredients are consumed from within a radius, and output drops at the workshop position.

## Phase 1 — Retrofit Existing Crafting (one PR)

### Workshop Types

| Workshop | Tile | Glyph | Color | For task | Build cost | Work |
|---|---|---|---|---|---|---|
| Still | `still` | `U` | `#8B6914` | `brew` | 1 wood | 50 |
| Kitchen | `kitchen` | `&` | `#cc6600` | `cook` | 1 stone + 1 wood | 50 |
| Forge | `forge` | `¤` | `#ff4400` | `smith` | 2 stone | 70 |

### Core Mechanic

**Task target = workshop position.** The dwarf walks to the workshop, not to the ingredient. Ingredients are found within `WORKSHOP_INGREDIENT_RADIUS = 5` Manhattan distance of the workshop.

**Workshop occupancy.** One dwarf at a time per workshop (uses existing `Structure.occupied_by_dwarf_id`). Auto-systems only create tasks if an unoccupied workshop exists.

**Task-to-workshop link.** `task.target_item_id` stores the workshop's structure ID (same pattern as sleep tasks linking to beds). On completion or failure, occupancy is released.

### Modified Auto-Brew Flow

```
1. Check drink stock < MIN_DRINK_STOCK (10)
2. Check no brew task already pending/active
3. Find an unoccupied still (findAvailableWorkshop)
4. Find plant raw_material within WORKSHOP_INGREDIENT_RADIUS of the still
5. If both found → create brew task targeting the still position
6. If no still or no nearby ingredient → do nothing (no brewing without infrastructure)
```

Same pattern for auto-cook (kitchen + nearby food) and future auto-smith.

### Modified Completion Flow

```
completeBrew:
  1. Search for plant raw_material within radius of task.target (workshop)
  2. Also check dwarf's held items (findItemHeldBy)
  3. If no ingredient → return (don't create output)
  4. Consume ingredient, create ale at workshop position
  5. Release workshop occupancy (clear occupied_by_dwarf_id)
```

### Backward Compatibility

When no workshop exists, the auto-systems simply don't create tasks. No crash — brewing/cooking just doesn't happen until the player builds a still/kitchen. This is a gameplay change: previously these happened automatically from tick 1.

**Embark change needed:** The embark function should place a starting still and kitchen so new fortresses aren't stuck without brewing/cooking.

### Workshop Construction

Uses the existing `completeBuildStructure` pattern (same as well, mushroom_garden, door). New build task types: `build_still`, `build_kitchen`, `build_forge`.

Added to the build menu in the UI alongside existing build options.

### Multiple Workshops

Supported naturally. Auto-systems pick the first unoccupied workshop. Two kitchens = two dwarves can cook simultaneously. This creates a simple but meaningful scaling decision: more workshops = faster production, but costs materials and space.

## Phase 2 — New Workshops (future PR)

| Workshop | Tile | Glyph | For task | What it produces |
|---|---|---|---|---|
| Craftsdwarf | `craftsdwarf` | `§` | `craft` | Trade goods from stone/wood |
| Carpenter | `carpentry` | `¶` | `carpentry` | Barrels, bins, wood furniture |
| Mason | `masonry` | `±` | `masonry` | Stone furniture, blocks, statues |

These add new task types and the **container system** (barrels for brewing, bins for storage) which creates the resource chain tension that makes DF compelling.

## Constants

```typescript
WORK_BUILD_STILL = 50
WORK_BUILD_KITCHEN = 50
WORK_BUILD_FORGE = 70
WORKSHOP_INGREDIENT_RADIUS = 5

BUILDING_COSTS:
  build_still:   [{ category: 'raw_material', material: 'wood', count: 1 }]
  build_kitchen: [{ category: 'raw_material', material: 'stone', count: 1 },
                  { category: 'raw_material', material: 'wood', count: 1 }]
  build_forge:   [{ category: 'raw_material', material: 'stone', count: 2 }]
```

## New Files

| File | Purpose |
|---|---|
| `sim/src/workshop-utils.ts` | `findAvailableWorkshop`, `findItemsNearWorkshop`, `TASK_WORKSHOP_MAP` |
| `sim/src/workshop-utils.test.ts` | Unit tests for workshop helpers |
| `supabase/migrations/00026_workshops.sql` | Add task types + tile types to enums |

## Files Modified

| File | Change |
|---|---|
| `shared/src/db-types.ts` | Add `build_still`, `build_kitchen`, `build_forge` to TASK_TYPES; add `still`, `kitchen`, `forge` to FortressTileType |
| `shared/src/constants.ts` | Add WORK_BUILD_*, BUILDING_COSTS entries, WORKSHOP_INGREDIENT_RADIUS |
| `sim/src/task-helpers.ts` | Add build_still/kitchen/forge → 'building' in TASK_SKILL_MAP |
| `sim/src/phases/task-completion.ts` | Add build cases; modify completeBrew/Cook/Smith for radius search + occupancy release |
| `sim/src/phases/auto-brew.ts` | Require still workshop, target workshop position |
| `sim/src/phases/auto-cook.ts` | Require kitchen workshop, target workshop position |
| `sim/src/pathfinding.ts` | Add still/kitchen/forge to WALKABLE_TILES |
| `sim/src/resource-check.ts` | No changes (BUILDING_COSTS drives it) |
| `app/src/components/tile-glyphs.ts` | Add glyphs + designation previews |
| `app/src/hooks/useDesignation.ts` | Add designation modes + BUILD_WORK entries |
| `app/src/components/BuildMenu.tsx` | Add workshop build options |

## Testing

- Workshop helpers: findAvailableWorkshop, findItemsNearWorkshop, radius filtering
- Auto-brew: no task without still, creates task at still position, respects radius, respects occupancy
- Auto-cook: same pattern for kitchen
- Task completion: releases occupancy, finds ingredients within radius, produces output at workshop
- Build: still/kitchen/forge construct correctly, can be deconstructed
- Scenario: embark → build still → farm plump helmets → auto-brew produces ale

## Open Questions

1. Should embark auto-place a starting still + kitchen? (Recommended yes, otherwise new players have no food processing)
2. Should the forge require fuel (charcoal) or just stone? (Keep simple for now — just stone)
3. Should stockpile-workshop proximity be explicitly optimizable, or is the radius system enough? (Radius is enough for now)
