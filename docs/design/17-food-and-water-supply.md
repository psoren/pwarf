# 17 — Food & Water Supply

> **Status:** Partial
> **Last verified:** 2026-04-04

## Problem

Food and water are currently unlimited. Three auto-phases (`auto-forage`, `auto-brew`, `auto-cook`) silently create production tasks whenever stocks drop below thresholds. The player never has to think about food supply — it's an invisible system that keeps dwarves alive without player input. This removes a core Dwarf Fortress gameplay pillar: managing the supply chain.

The interesting decision should be **"have I set up enough food production?"** not **"tell each dwarf to eat."**

## Current State (what's being replaced)

### Auto-production phases (run every tick)

| Phase | File | Trigger | Output |
|---|---|---|---|
| Auto-Cook (13) | `auto-cook.ts` | Cooked food < `MIN_COOK_STOCK` (15) | Creates `cook` task from raw food |
| Auto-Brew (14) | `auto-brew.ts` | Drink count < `MIN_DRINK_STOCK` (10) | Creates `brew` task from plant material |
| Auto-Forage (15) | `auto-forage.ts` | Food count < `MIN_FORAGE_FOOD_STOCK` (5) | Creates `forage` task on grass/bush tiles |

These phases make food infinite — as long as forageable tiles exist, dwarves never starve. The player has no visibility into or control over this production.

### What stays unchanged

- **Autonomous eat/drink/sleep** (`need-satisfaction.ts`) — dwarves self-manage consumption when food/drink items exist
- **Wells** — infinite water source (player decision is "build wells in good locations")
- **Deprivation/starvation** (`deprivation.ts`) — dwarves die after prolonged zero-need
- **Farming chain** — `farm_till` → `farm_plant` → `farm_harvest` produces food
- **Trade caravans** — arrive every 2 years with food + drink

## Design

### 1. Remove auto-production phases

Delete `autoCookPhase`, `autoBrew`, and `autoForage` from the tick loop in `tick.ts`. Food/drink production now requires player action.

### 2. Forage Zones (replaces auto-forage)

A new player designation mode. The player paints forage zones on eligible tiles (like stockpile zones). A new phase creates forage tasks within those zones.

**Player action:** New designation mode `forage_zone` (key: `g` for gather). Player paints an area over grass, tree, bush, or cave_mushroom tiles. This creates a persistent zone, not one-shot tasks.

**Sim behavior:** New phase `forageZoneTick` (replaces `autoForage` in the tick loop) scans forage zone tiles each tick:
- For each zone, count active/pending forage tasks targeting tiles within it
- If fewer than `FORAGE_ZONE_MAX_TASKS` (2) active tasks, create a new `forage` task on a random eligible tile in the zone
- Only create tasks when idle dwarves exist (no point queuing work nobody will do)

**Tile depletion:** On forage task completion, there is a `FORAGE_DEPLETE_CHANCE` (0.15) that grass/bush tiles convert to `soil` (depleted). This makes foraging unsustainable long-term and pushes the player toward farming. Trees and cave_mushroom tiles never deplete.

**Data model:** New `designated_zones` table:

```sql
CREATE TABLE designated_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  civilization_id UUID NOT NULL REFERENCES civilizations(id),
  x INT NOT NULL,
  y INT NOT NULL,
  z INT NOT NULL,
  zone_type TEXT NOT NULL,  -- 'forage' for now, extensible
  UNIQUE (civilization_id, x, y, z, zone_type)
);
```

### 3. Manual Brew and Cook Tasks

Brew and cook tasks already exist as completable task types. Without auto-phases, the player must manually designate them. Two paths:

**Path A (v1 — manual designation):** Player creates brew/cook tasks at workshop tiles (see doc 13). Requires raw materials within workshop ingredient radius.

**Path B (future — idle behavior):** Once the idle behavior system (doc 11) is implemented, skilled idle dwarves auto-create brew/cook tasks — but gated by skill. Only a dwarf with brewing skill brews. Only a dwarf with cooking skill cooks. This makes starting roles meaningful. Thresholds move from the deleted auto-phases into idle behavior weights.

### 4. Starting Provisions

Current embark: 15 dried meat, 0 drink items, 1 well.

New embark:
- **25 food items** (dried meat) — enough for 7 dwarves for ~2-3 in-game days
- **10 drink items** (dwarven ale) — supplements the starting well
- **Auto-designated 5x5 forage zone** on grass tiles near fortress center — gives immediate food production while making the mechanic visible to the player

### 5. Supply Warnings

New events in `event-firing.ts`:

| Event | Trigger | Message |
|---|---|---|
| Food shortage | Food items < alive dwarf count, no active forage/farm tasks | "Food stores running low!" |
| Drink shortage | Drink items < alive dwarf count, no active brew tasks, no completed wells | "Drink stores running low!" |

These fire once per condition change (not every tick) using the existing `warnedNeedIds` deduplication pattern.

## Food Production Summary

After this change, the player's food/drink sources are:

| Source | Type | Renewable? | Player Action Required |
|---|---|---|---|
| Starting provisions | Food + drink | No | None (embark) |
| Forage zones | Food (berries, mushrooms) | Semi (tiles deplete) | Designate zone |
| Farming | Food (plump helmets) | Yes | Designate farm plots |
| Cooking | Food (prepared meals) | Yes (from raw food) | Designate cook task / build kitchen |
| Brewing | Drink (ale) | Yes (from plant material) | Designate brew task / build still |
| Wells | Water | Yes (infinite) | Build well |
| Trade caravans | Food + drink | Yes (every 2 years) | None (automatic) |
| Mining cave mushrooms | Food | No (one-time per tile) | Designate mine |

## Food & Drink Nutrition Values (Implemented)

Different food and drink items restore varying amounts of need based on their name and quality. This replaces the old flat `FOOD_RESTORE_AMOUNT` / `DRINK_RESTORE_AMOUNT` system.

### Base nutrition by food name

| Food | Base Nutrition | Source |
|---|---|---|
| Wild mushroom | 35 | Foraged (raw) |
| Berries | 40 | Foraged (raw) |
| Plump helmet | 40 | Farm produce (raw) |
| Dried meat | 50 | Starting provisions |
| Cured meat | 55 | Trade caravan |
| Prepared meal | 75 | Cooked |
| Unknown food | 60 (fallback) | Any other |

### Base hydration by drink name

| Drink | Base Hydration | Source |
|---|---|---|
| Plump helmet brew | 65 | Homebrew |
| Dwarven ale | 80 | Trade caravan |
| Unknown drink | 70 (fallback) | Any other |

### Quality multipliers

Quality modifies the base value: `final = round(base * multiplier)`, capped at `MAX_NEED` (100).

| Quality | Multiplier |
|---|---|
| garbage | 0.5x |
| poor | 0.75x |
| standard | 1.0x |
| fine | 1.1x |
| superior | 1.2x |
| exceptional | 1.3x |
| masterwork | 1.5x |
| artifact | 2.0x |

Helper functions `getNutritionValue(item)` and `getHydrationValue(item)` in `shared/src/food-values.ts` compute the final value from an item's name and quality.

## Constants

```typescript
// Forage zones
FORAGE_ZONE_MAX_TASKS = 2        // max concurrent forage tasks per zone
FORAGE_DEPLETE_CHANCE = 0.15     // chance grass/bush → soil on forage completion

// Supply warnings
FOOD_WARNING_COOLDOWN_TICKS = 1800  // don't spam warnings

// Idle behavior thresholds (future, doc 11)
IDLE_BREW_THRESHOLD = 8          // idle dwarves brew when drink stock < this
IDLE_COOK_THRESHOLD = 10         // idle dwarves cook when cooked food < this
```

## Implementation Phases

### Phase A: Remove auto-production + increase provisions

One PR. Remove the three auto-phases from `tick.ts`, increase starting food/drink in `embark.ts`, add supply shortage warnings.

**Files:**
- `sim/src/tick.ts` — remove `autoCookPhase`, `autoBrew`, `autoForage` calls
- `sim/src/phases/index.ts` — remove exports
- `app/src/lib/embark.ts` — 25 food + 10 drink
- `sim/src/phases/event-firing.ts` — supply warnings
- `shared/src/constants.ts` — remove `MIN_FORAGE_FOOD_STOCK`, `MIN_DRINK_STOCK`, `MIN_COOK_STOCK`

### Phase B: Forage zones

Follow-up PR. New designation mode, new phase, tile depletion, DB migration.

**Files:**
- `sim/src/phases/forage-zone-tick.ts` — **new**, zone-based forage task creation
- `app/src/hooks/useDesignation.ts` — add `forage_zone` mode
- `sim/src/phases/task-completion.ts` — forage tile depletion
- `supabase/migrations/00NNN_designated_zones.sql` — **new** table
- `sim/src/tick.ts` — wire `forageZoneTick` into loop

### Phase C: Polish

Follow-up PR. Tutorial notifications, starting forage zone auto-designation, UI stock count indicator.

## Testing

- **Starvation scenario:** 7 dwarves, 25 food, no forage zones, 50000 ticks → food runs out, dwarves eventually starve
- **Forage zone scenario:** 7 dwarves, forage zone designated on grass tiles, 50000 ticks → food stays stocked, dwarves survive
- **Depletion scenario:** Small forage zone (4 tiles), high activity → tiles deplete to soil → food production drops → player must expand zone or farm
- **No regression:** Existing farming, well, and caravan tests still pass

## Open Questions

1. Should brew/cook get "standing orders" (repeat-on-completion) as an interim step before idle behaviors?
2. Should forage zone depletion be deterministic (after N harvests) or probabilistic (current design: 15% per harvest)?
3. Should depleted tiles (soil from forage) regrow over time, or stay depleted permanently?
