# 11 — Autonomous Dwarf Behavior

> **Status:** Implemented
> **Last verified:** 2026-04-09

## Problem

When dwarves have no player-designated tasks and no urgent needs, they stand still doing nothing. The fortress feels dead. Cooking, brewing, and foraging happen automatically via hidden auto-systems, but the player has no visibility into or control over them. Dwarves should feel alive — doing useful things, socializing, and expressing their personalities.

## Current State

- `isDwarfIdle()` returns true when a dwarf is alive, has no `current_task_id`, and is not in a tantrum.
- `jobClaiming` matches idle dwarves to pending tasks. If no tasks exist, nothing happens.
- `wander` exists as a task type but is never created.
- `autoForage`, `autoBrew`, `autoCook` run as phases and create tasks when stock thresholds are low, but are invisible to the player.
- Personality traits (`trait_openness`, `trait_conscientiousness`, `trait_extraversion`, `trait_agreeableness`, `trait_neuroticism`) exist on every dwarf but don't drive behavior.

## Design

### Idle Behavior Phase

A new phase `idleBehavior` runs after `autoForage` and before `jobClaiming` in the tick loop. It scans for idle dwarves and creates low-priority autonomous tasks using weighted random selection influenced by personality traits.

```
tick loop order:
  ...
  await autoForage(ctx);
  await idleBehavior(ctx);   // ← new
  await jobClaiming(ctx);
  ...
```

### Priority System

Idle tasks use priority 1–3, below the default player task priority of 5. Player-designated tasks always win in `jobClaiming` scoring. Dwarves on idle tasks can be reassigned when a higher-priority task appears.

### Behaviors (priority order)

| Behavior | Priority | Trigger | Task Type | New? |
|---|---|---|---|---|
| Re-farm | 3 | Soil tile at z=0, no existing farm_till task for it | `farm_till` | No |
| Socialize | 2 | Another alive dwarf within distance 30 | `socialize` | Yes |
| Rest at meeting area | 2 | A completed well or mushroom_garden exists | `rest` | Yes |
| Wander | 1 | Always available (fallback) | `wander` | No |

### Personality-Driven Selection

Instead of strict priority, use weighted random selection where personality traits shift the weights:

```
Base weights:
  re-farm:    10  × conscientiousness modifier
  socialize:   8  × extraversion modifier (boosted when need_social < 40)
  rest:         6  × openness modifier (boosted for introverts)
  wander:       3  (no modifier, always available)

Trait modifier formula:
  traitMod(trait, scale) = max(0.2, 1.0 + (trait - 0.5) × scale)

  Example: extraversion = 0.9, scale = 2.0
  → 1.0 + (0.9 - 0.5) × 2.0 = 1.8 → socialize weight = 8 × 1.8 = 14.4

  Example: extraversion = 0.1, scale = 2.0
  → 1.0 + (0.1 - 0.5) × 2.0 = 0.2 → socialize weight = 8 × 0.2 = 1.6
```

### Behavior Details

#### Re-Farming

Scans fortress tile overrides for `soil` tiles at z=0 with no pending `farm_till` task. Creates a `farm_till` task at the nearest soil tile. This chains automatically: till → plant → harvest, keeping farms productive without player micro.

- **Work**: `WORK_FARM_TILL_BASE` (60)
- **Skill**: farming
- **Personality**: High conscientiousness → more likely

#### Socializing

Picks another alive dwarf weighted by relationship (spouse > friend > acquaintance > stranger) and proximity. Creates a `socialize` task targeting a tile adjacent to that dwarf.

- **Work**: `WORK_SOCIALIZE` (30 ticks of "chatting" after arrival)
- **On completion**:
  - Restore `need_social` by `SOCIALIZE_MORALE_RESTORE` (8)
  - 30% chance to form acquaintance relationship with strangers
  - Generate thought: "enjoyed talking with [name]"
- **Personality**: High extraversion → much more likely. High agreeableness → slightly more likely.

#### Resting at Meeting Area

Walks to a completed well or mushroom_garden structure and idles there. The passive beauty proximity bonus in `need-satisfaction` already applies while nearby.

- **Work**: `WORK_REST` (20 ticks)
- **On completion**:
  - Restore `need_social` by `REST_MORALE_RESTORE` (5)
  - Generate thought: "enjoyed resting by the [structure]"
- **Personality**: High openness → more likely. Low extraversion → more likely (introverts prefer quiet rest over socializing).

#### Wandering

Walk to a random walkable tile 3–8 tiles away. Makes dwarves look alive. No special effect on completion.

- **Work**: `WORK_WANDER` (1 tick — instant on arrival)
- **Personality**: No modifier (baseline fallback)

### Interruptibility

Idle tasks must be interruptible by:
1. **Urgent needs** — `needSatisfaction` already drops non-autonomous tasks when needs are critical. Idle tasks are NOT in `AUTONOMOUS_TASK_TYPES`, so they get interrupted.
2. **Player-designated tasks** — Modify `jobClaiming` to treat dwarves on idle tasks as "available":

```typescript
// Dwarves on idle tasks can be reassigned
const isAvailable = isDwarfIdle(d) || (
  d.current_task_id && IDLE_TASK_TYPES.has(
    state.tasks.find(t => t.id === d.current_task_id)?.task_type
  )
);
```

When reassigning, cancel the idle task (don't revert to pending).

### Cooldown

A dwarf that just completed an idle task waits `IDLE_BEHAVIOR_COOLDOWN_TICKS` (50 ticks, ~5 seconds) before getting another one. Track via `state._idleCooldowns: Map<string, number>`.

## New Task Types

| Type | Skill Required | Adjacent? | DB Migration |
|---|---|---|---|
| `socialize` | none | No (stand on tile) | Yes |
| `rest` | none | No (stand on tile) | Yes |

`wander` and `farm_till` already exist.

## Constants

```typescript
// Idle behavior timing
IDLE_BEHAVIOR_COOLDOWN_TICKS = 50

// Work requirements
WORK_SOCIALIZE = 30
WORK_REST = 20
WORK_WANDER = 1

// Morale restoration
SOCIALIZE_MORALE_RESTORE = 8
REST_MORALE_RESTORE = 5
SOCIALIZE_ACQUAINTANCE_CHANCE = 0.3

// Selection weights
IDLE_WEIGHT_REFARM = 10
IDLE_WEIGHT_SOCIALIZE = 8
IDLE_WEIGHT_REST = 6
IDLE_WEIGHT_WANDER = 3

// Targeting
SOCIALIZE_MAX_DISTANCE = 30
WANDER_DISTANCE_MIN = 3
WANDER_DISTANCE_MAX = 8
```

## Files to Create/Modify

| File | Change |
|---|---|
| `sim/src/phases/idle-behavior.ts` | **New** — core phase |
| `sim/src/phases/idle-behavior.test.ts` | **New** — unit tests |
| `sim/src/__tests__/idle-behavior-scenario.test.ts` | **New** — scenario tests |
| `shared/src/db-types.ts` | Add `socialize`, `rest` to `TASK_TYPES` |
| `shared/src/constants.ts` | Add all constants above |
| `sim/src/task-helpers.ts` | Add `socialize: null, rest: null` to `TASK_SKILL_MAP` |
| `sim/src/phases/task-completion.ts` | Add completion handlers |
| `sim/src/phases/index.ts` | Export `idleBehavior` |
| `sim/src/tick.ts` | Wire into tick loop |
| `sim/src/phases/job-claiming.ts` | Allow reassignment from idle tasks |
| `supabase/migrations/00026_idle_task_types.sql` | Add enum values |

## Implementation Order

1. Constants and types (add task types, constants, skill map entries)
2. Core phase with wander only (validate architecture)
3. Re-farming
4. Socializing (+ completion handler, relationship formation)
5. Resting (+ completion handler)
6. Job-claiming interruption
7. DB migration

## Testing

**Unit tests**: Selection weighting with personality traits, no duplicate task creation, cooldown enforcement, target selection for socializing.

**Scenario tests**:
- Idle fortress: 7 dwarves, no tasks, 300 ticks → dwarves create and complete idle tasks, `need_social` stays healthy
- Auto-replant: soil tiles from previous harvest → `farm_till` auto-created
- Interruption: dwarves wandering, player mine task injected → dwarves switch to mining
- Long-run stability: 5000 ticks with idle behaviors → no crashes, no stuck dwarves
