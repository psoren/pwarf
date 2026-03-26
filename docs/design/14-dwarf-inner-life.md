# 14 — Dwarf Inner Life

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

Three tightly coupled systems give dwarves an inner emotional life: **memories**, **relationships**, and **thought generation**. Together they create emergent narrative — a dwarf witnesses a friend's death, grieves, accumulates stress, throws a tantrum, and potentially kills another dwarf, triggering a cascade.

## Files

| File | Role |
|---|---|
| `sim/src/dwarf-memory.ts` | Memory CRUD, factory functions for each memory type |
| `sim/src/phases/relationship-formation.ts` | Yearly phase: acquaintance, friend, and spouse progression |
| `sim/src/phases/thought-generation.ts` | Per-tick personality-influenced thought generation |

## Memory System

Memories are stored as a JSONB array in the `dwarves.memories` column. Each memory has:

| Field | Type | Description |
|---|---|---|
| `type` | string | One of the memory types below |
| `intensity` | number | Positive = stress-inducing, negative = stress-relieving |
| `year` | number | Year the memory was formed |
| `expires_year` | number | Year after which the memory is stripped |

### Memory Types

| Type | Intensity | Duration (years) | Trigger |
|---|---|---|---|
| `witnessed_death` | 15 | 3 | Alive dwarf within radius 5 of a death |
| `created_artifact` | -20 | 5 | Dwarf completes an artifact |
| `created_masterwork` | -10 | 2 | Dwarf creates a masterwork/exceptional item |
| `married_joy` | -20 | 5 | Both spouses on marriage |
| `grief_friend` | 25 | 5 | Friend dies (+ immediate 20 stress spike) |
| `grief_spouse` | 40 | 10 | Spouse dies (+ immediate 35 stress spike) |

### Memory Lifecycle

1. **Creation** — Factory functions (`createWitnessDeathMemories`, `createGriefFriendMemories`, etc.) add memories via `addMemory()`, which appends to the JSONB array and marks the dwarf dirty.
2. **Active filtering** — `activeMemories(dwarf, currentYear)` returns only non-expired memories. Used by the stress-update phase.
3. **Decay** — `decayMemories(dwarf, currentYear, state)` strips expired memories during the yearly rollup.
4. **Stress contribution** — Each active memory contributes `MEMORY_STRESS_PER_TICK (0.00027) * intensity` to the dwarf's stress every tick. Positive intensity increases stress; negative intensity relieves it.

### Witness Death Mechanics

When any dwarf dies (from any cause — deprivation, combat, tantrum), `createWitnessDeathMemories` is called:

- All alive dwarves on the same z-level within `WITNESS_DEATH_RADIUS = 5` Manhattan distance receive a `witnessed_death` memory.
- The deceased dwarf is excluded.

### Grief Mechanics

After witness memories are applied, relationship-based grief is processed:

- **Friend death** (`createGriefFriendMemories`): Every alive dwarf with a `friend` relationship to the deceased receives an immediate `GRIEF_FRIEND_STRESS = 20` stress spike plus a `grief_friend` memory (intensity 25, 5-year duration).
- **Spouse death** (`createGriefSpouseMemories`): The surviving spouse receives an immediate `GRIEF_SPOUSE_STRESS = 35` stress spike plus a `grief_spouse` memory (intensity 40, 10-year duration).

## Relationship System

Relationships are stored in the `dwarfRelationships` array on `CachedState`, typed as `DwarfRelationship`.

### Canonical Ordering

To prevent duplicate relationships, IDs are stored in lexicographic order: `dwarf_a_id < dwarf_b_id`. The `sortedIds()` helper enforces this, and `canonicalKey()` builds a lookup key from any pair.

### Yearly Progression

The `relationshipFormationPhase` runs once per year during the yearly rollup. For every pair of alive dwarves:

```
nothing ──(30% chance)──> acquaintance
                              │
                    (after 2 years as acquaintance)
                              │
                              v
                           friend
                              │
                    (after 3 years as friend, 5% chance)
                              │
                              v
                           spouse
```

| Transition | Constant | Value |
|---|---|---|
| Nothing to acquaintance | `FRIENDSHIP_FORMATION_CHANCE` | 0.3 (30%) |
| Acquaintance to friend | `FRIEND_UPGRADE_YEARS` | 2 years |
| Friend to spouse | `MARRIAGE_FRIEND_MIN_YEARS` | 3 years as friend |
| Friend to spouse (probability) | `MARRIAGE_CHANCE` | 0.05 (5%) |

Key details:
- When an acquaintance upgrades to friend, `formed_year` is reset to the current year so the marriage timer counts from friendship, not from first meeting.
- Marriage triggers `createMarriageMemories` (joy memories for both) and a world event.
- Strength increases on each upgrade (capped at 10).

## Thought Generation

The `thoughtGeneration` phase runs every tick but only processes every `THOUGHT_INTERVAL = 10` ticks (1 game-second).

### Storage

Thoughts are stored in the same `dwarf.memories` JSONB column as memories, but as `Thought` objects with a different shape:

| Field | Type | Description |
|---|---|---|
| `text` | string | Human-readable thought text |
| `tick` | number | Tick when the thought was generated |
| `sentiment` | `"positive" \| "negative" \| "neutral"` | Emotional valence |

Maximum `MAX_THOUGHTS = 10` thoughts per dwarf. When the cap is exceeded, the oldest thoughts are trimmed.

### Generators

Four generators run for each alive dwarf:

1. **Need thoughts** — Hunger, thirst, sleep, morale. Thresholds adjusted by neuroticism (`adjustedThreshold(base, trait)`). Each personality point shifts the threshold by 5, so a neurotic dwarf (neuroticism +3) starts worrying at need level 45 instead of 30.
2. **Work thoughts** — Idle dwarves generate boredom (conscientiousness amplifies distress). Working dwarves with decent morale feel productive.
3. **Stress thoughts** — High stress triggers worry; neuroticism lowers the threshold. Tantrum state generates its own thought.
4. **Health thoughts** — Wounded dwarves generate pain thoughts at health < 50.

### Deduplication

`hasRecentThought(dwarf, text, currentTick)` prevents the same thought from appearing within 50 ticks. This stops thought spam when a dwarf stays in the same state for extended periods.

### Personality Influence

Personality traits (Big Five: openness, conscientiousness, extraversion, agreeableness, neuroticism) range from -3 to +3. The `adjustedThreshold(base, traitValue)` function shifts base thresholds by `traitValue * 5`:

- **Neuroticism** affects hunger/thirst/sleep worry thresholds and stress awareness.
- **Conscientiousness** affects idle-boredom threshold.

## System Interactions

The three systems form a feedback loop that creates emergent narrative:

```
Relationship Formation (yearly)
       │
       ├── creates bonds between dwarves
       │
Dwarf Death (any cause)
       │
       ├── createWitnessDeathMemories (proximity-based)
       ├── createGriefFriendMemories (relationship-based, +20 stress spike)
       └── createGriefSpouseMemories (relationship-based, +35 stress spike)
                │
                v
       Stress Update Phase (per-tick)
                │
                ├── MEMORY_STRESS_PER_TICK * intensity per active memory
                │
                v
       Tantrum Check Phase
                │
                ├── high stress → tantrum → potential dwarf death
                │                                    │
                └────────────────────────────────────┘
                         (cascade loop)

Thought Generation (every 10 ticks)
       │
       └── surfaces the dwarf's inner state as readable text
```

The tantrum spiral is the key emergent behavior: one death can cascade through grief and stress into more deaths, especially in small fortresses with dense relationships. Long-duration grief memories (spouse grief lasts 10 years) ensure the effects persist across multiple game years.

## Constants

```typescript
// Memory intensities (positive = stress, negative = relief)
MEMORY_WITNESSED_DEATH_INTENSITY = 15
MEMORY_ARTIFACT_INTENSITY = -20
MEMORY_MASTERWORK_INTENSITY = -10
MEMORY_MARRIAGE_JOY_INTENSITY = -20
MEMORY_GRIEF_FRIEND_INTENSITY = 25
MEMORY_SPOUSE_GRIEF_INTENSITY = 40

// Memory durations
MEMORY_WITNESSED_DEATH_DURATION_YEARS = 3
MEMORY_ARTIFACT_DURATION_YEARS = 5
MEMORY_MASTERWORK_DURATION_YEARS = 2
MEMORY_GRIEF_FRIEND_DURATION_YEARS = 5
MEMORY_MARRIAGE_JOY_DURATION_YEARS = 5
MEMORY_SPOUSE_GRIEF_DURATION_YEARS = 10

// Stress
WITNESS_DEATH_RADIUS = 5
GRIEF_FRIEND_STRESS = 20
GRIEF_SPOUSE_STRESS = 35
MEMORY_STRESS_PER_TICK = 0.00027

// Relationships
FRIENDSHIP_FORMATION_CHANCE = 0.3
FRIEND_UPGRADE_YEARS = 2
MARRIAGE_CHANCE = 0.05
MARRIAGE_FRIEND_MIN_YEARS = 3

// Thoughts
THOUGHT_INTERVAL = 10  (local constant)
MAX_THOUGHTS = 10      (local constant)
```
