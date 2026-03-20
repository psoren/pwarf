# Dwarf Decision-Making

This document explains how dwarves decide what to do each simulation tick.

## Overview

Every simulation tick runs these phases in order:

1. **needsDecay** — all needs (food, drink, sleep, etc.) tick down
2. **taskExecution** — dwarves with a task make progress on it
3. **needsSatisfaction** — dwarves check if a completed eat/drink/sleep task restored needs
4. **idleWandering** — dwarves with no task are given a wander task
5. **jobClaiming** — idle dwarves claim the highest-scoring pending task

---

## 1. Needs Decay

Each tick, every living dwarf's needs drop by fixed amounts:

| Need | Decay per tick | Trait modifier |
|------|---------------|----------------|
| Food | `FOOD_DECAY_PER_TICK` | — |
| Drink | `DRINK_DECAY_PER_TICK` | — |
| Sleep | `SLEEP_DECAY_PER_TICK` | — |
| Social | `SOCIAL_DECAY_PER_TICK` | `trait_extraversion` (extraverts decay faster) |
| Purpose | `PURPOSE_DECAY_PER_TICK` | — |
| Beauty | `BEAUTY_DECAY_PER_TICK` | — |

When a need reaches 0 for too long, the dwarf dies. Food and drink deprivation cause death; sleep deprivation causes tantrums.

---

## 2. Task Execution

For each dwarf with a `current_task_id`:

1. **Move toward the task site** (one BFS step per tick). Mining and build_wall tasks require the dwarf to stand *adjacent* to the target; all others require standing *on* the target.
2. **Do work** — increment `task.work_progress` by the work rate:
   ```
   workRate = (BASE_WORK_RATE × (1 + skillLevel × 0.1) × conscientiousnessModifier) / hardness
   ```
   - `BASE_WORK_RATE = 1`
   - Skill modifier: +10% per skill level in the relevant skill
   - `conscientiousnessModifier`: 0.75x (lazy) → 1.25x (diligent) based on `trait_conscientiousness`
   - `hardness`: 0.3 for soil, 1.0 for stone, 1.2–1.5 for ore/gem/lava
3. **Complete the task** when `work_progress >= work_required`. Side effects:
   - `eat` / `drink` → restore the need, increment XP
   - `sleep` → restore `need_sleep` (also ticks up every tick while sleeping)
   - `mine` → change the tile to `open_air`, add ore/gem items, award XP
   - `build_*` → place the constructed tile (wall, floor, bed, well, etc.), award XP
   - `haul` → move an item to the stockpile
   - `wander` → just cancels, no effect

If the dwarf can't find a path to the task, the task reverts to `pending` and the dwarf becomes idle. Wander tasks are marked `completed` instead of reverting.

---

## 3. Needs Satisfaction Check

After task execution, the sim checks whether any recently-completed eat/drink tasks should grant need restoration. This phase handles the case where need values need to be updated after a task completes.

---

## 4. Idle Wandering

Dwarves with no current task are assigned a `wander` task to a random walkable tile within `WANDER_RADIUS` tiles. This prevents dwarves from standing still while waiting for work. The wander task takes 1 tick of work to complete (just movement).

---

## 5. Job Claiming

This is where the real decision-making happens.

### Eligibility

A dwarf can claim a task if:
- The task status is `pending`
- The task is not autonomous (eat/drink/sleep/wander tasks are self-claimed only)
- The dwarf has the required skill, if any (mine requires `mining`; build_* requires `building`; farm_* requires `farming`)
- The dwarf is not over carry capacity for mine tasks

Autonomous tasks (eat, drink, sleep) are pre-assigned to a specific dwarf. They enter the queue via the needs-satisfaction or other phases and can only be claimed by `assigned_dwarf_id`.

### Scoring

For each (dwarf, task) pair, the sim computes a score:

```
score = (task.priority × SCORE_PRIORITY_WEIGHT)
      + (skillLevel × SCORE_SKILL_WEIGHT)
      + (hasRequiredSkill ? SCORE_BEST_SKILL_BONUS : 0)
      - (distanceToTask × SCORE_DISTANCE_WEIGHT)
```

| Constant | Value | Effect |
|----------|-------|--------|
| `SCORE_PRIORITY_WEIGHT` | 3 | Higher-priority tasks win |
| `SCORE_SKILL_WEIGHT` | 2 | Skilled dwarves prefer matching tasks |
| `SCORE_BEST_SKILL_BONUS` | 5 | Big bonus for having the right skill |
| `SCORE_DISTANCE_WEIGHT` | 0.5 | Nearby tasks are slightly preferred |

The idle dwarf is assigned the highest-scoring task. Multiple dwarves can't claim the same task in one tick — a task transitions from `pending` → `claimed` when assigned, preventing double-assignment.

### Task priority

Default priorities are configured in TaskPriorities (player-adjustable). High priority tasks are worth 3× as much as low priority ones. The player can raise mining priority so dwarves prefer digging over hauling, for example.

---

## Task Status Flow

```
pending → claimed → in_progress → completed
                               ↘ failed (no path found, reset to pending)
```

Wander tasks: `pending → in_progress → completed` (never reverted, never re-queued by the player).

---

## Personality Trait Effects

| Trait | Range | Effect |
|-------|-------|--------|
| `trait_conscientiousness` | 0–1 | Work rate multiplier (0 = 0.75×, 0.5 = 1×, 1 = 1.25×) |
| `trait_extraversion` | 0–1 | Social need decays faster for extraverts |
| `trait_neuroticism` | 0–1 | Stress increases faster for neurotic dwarves |
| `trait_agreeableness` | 0–1 | Agreeable dwarves recover stress faster when comfortable |

All traits are 0–1 floats with 0.5 as the neutral/average value.
