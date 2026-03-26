# 16 — Expeditions

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

Expeditions send a party of dwarves to explore ancient ruins. Dwarves travel to the ruin, face dangers, loot treasure, and return home. The system is split into a pure resolution function and a per-tick state machine that drives the lifecycle.

## Files

| File | Role |
|---|---|
| `sim/src/expedition-resolution.ts` | Pure function: danger calculation, survival rolls, loot generation |
| `sim/src/phases/expedition-tick.ts` | Per-tick state machine advancing expedition status |

## Expedition Status Flow

```
traveling ──(arrival)──> resolve ──> retreating ──(arrival)──> complete
```

1. **Traveling** — Each tick, `travel_ticks_remaining` is decremented. Travel duration is calculated by `calculateTravelTicks(distance, terrain)` at expedition creation.
2. **Resolution** — When `travel_ticks_remaining` reaches 0, the expedition arrives at the ruin. `resolveExpedition()` is called to determine casualties and loot. The expedition transitions to `retreating`.
3. **Retreating** — Each tick, `return_ticks_remaining` is decremented. Return distance uses the same Manhattan distance but always assumes `plains` terrain.
4. **Complete** — When `return_ticks_remaining` reaches 0, surviving dwarves are placed at fortress center (256, 256, 0), loot items are created, and a world event fires.

## Resolution (`resolveExpedition`)

A pure, deterministic function (given a seeded RNG) with no side effects. The caller applies the outcome to state.

### Danger Calculation

```
effectiveDanger = ruin.danger_level
                + 20  (if resident_monster_id exists)
                + 15  (if is_trapped)
                + 10  (if is_contaminated)
```

### Survival Rolls

For each dwarf in the party:

```
survivalRoll = rng.random()        // 0.0 to 1.0
deathThreshold = effectiveDanger / 200
```

If `survivalRoll > deathThreshold`, the dwarf survives. Otherwise, they are lost.

Example: a ruin with `danger_level = 50` and a monster (`+20`) has `effectiveDanger = 70`. Death threshold = 70/200 = 0.35, so each dwarf has a 35% chance of death.

### Loot Generation

Loot is only generated if survivors exist and the ruin has `remaining_wealth > 0`.

**Loot count:** `max(1, min(5, floor(remaining_wealth / 500)))` — between 1 and 5 items.

For each item:
- **Category** — Random from `LOOT_CATEGORIES`: gem, weapon, armor, crafted, raw_material
- **Material** — Random from `LOOT_MATERIALS`: iron, bronze, gold, silver, obsidian, crystal, bone, jade
- **Quality** — Scales with ruin wealth. Index = `min(4, floor((remaining_wealth / 10000) * 5 * rng.random()))`. Tiers from `QUALITY_TIERS`: standard, fine, superior, exceptional, masterwork. Wealthier ruins produce higher quality loot on average.
- **Value** — `floor(50 + rng.random() * (remaining_wealth / lootCount))`, clamped so total `wealthExtracted` does not exceed `remaining_wealth`.

### Outcome Object

```typescript
interface ExpeditionOutcome {
  survivingDwarfIds: string[];
  lostDwarfIds: string[];
  lootedItems: Array<{ category: ItemCategory; material: string; quality: ItemQuality }>;
  wealthExtracted: number;
  log: string;  // narrative summary
}
```

## Expedition Tick Phase

The `expeditionTick` phase processes all active expeditions each tick.

### Traveling Phase

- Decrement `travel_ticks_remaining`, mark expedition dirty.
- On arrival (`<= 0`):
  - Look up the target ruin.
  - Gather party dwarves and their skills.
  - Call `resolveExpedition()`.
  - Deduct `wealthExtracted` from `ruin.remaining_wealth`.
  - Mark dead dwarves (`status = 'dead'`, `cause_of_death = 'expedition'`), release their tasks.
  - Store outcome fields on the expedition object (`dwarves_lost`, `expedition_log`, `items_looted`).
  - Transition to `retreating` status.
  - Calculate return trip ticks using Manhattan distance with `plains` terrain.
  - Stash loot details in `state._pendingExpeditionLoot` map for item creation on return.

### Retreating Phase

- Decrement `return_ticks_remaining`, mark expedition dirty.
- On arrival (`<= 0`):
  - Identify surviving dwarves (not dead).
  - Return survivors to fortress center (256, 256, 0), set `status = 'alive'`, release tasks.
  - Create loot items from `_pendingExpeditionLoot` at fortress center (only if survivors exist to carry them back).
  - Clean up pending loot map entry.
  - Set expedition `status = 'complete'`, record `completed_at`.
  - Fire a `discovery` world event with expedition outcome details.

## Integration

Expeditions tie into several other systems:

- **Death processing** — Lost dwarves trigger the standard death path (witness memories, grief, stress).
- **Item system** — Loot items are created at fortress center and enter the normal hauling pipeline.
- **World events** — Expedition return fires a `discovery` event visible in the event log.
- **Ruins** — `remaining_wealth` is permanently reduced, making repeated expeditions to the same ruin yield diminishing returns.

## Constants

```typescript
// Loot categories and materials (local to expedition-resolution.ts)
LOOT_CATEGORIES = ['gem', 'weapon', 'armor', 'crafted', 'raw_material']
LOOT_MATERIALS = ['iron', 'bronze', 'gold', 'silver', 'obsidian', 'crystal', 'bone', 'jade']
QUALITY_TIERS = ['standard', 'fine', 'superior', 'exceptional', 'masterwork']

// Danger modifiers
+20 for resident monster
+15 for traps
+10 for contamination

// Death threshold
deathThreshold = effectiveDanger / 200
```
