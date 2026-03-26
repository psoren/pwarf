# Dwarf Task Dispatch

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

This document specifies how dwarves receive, claim, execute, and complete tasks — the system that connects player intent (dig designations, farm plots) to dwarf behavior. Without this, dwarves exist and get hungry but never do anything about it.

The goal is a playable core loop: **dig, eat, survive.** A player designates tiles to dig, dwarves walk over and excavate them, stone gets hauled to stockpiles, farms produce food, and dwarves autonomously eat, drink, and sleep to stay alive. If food runs out, they starve and die. That tension is the game.

---

## Task Lifecycle

Every task moves through a fixed state machine:

```
PENDING → CLAIMED → IN_PROGRESS → COMPLETED
                                 → FAILED
                                 → CANCELLED
```

| State | Meaning |
|-------|---------|
| `pending` | Created but no dwarf assigned. Available for claiming. |
| `claimed` | A dwarf has been assigned. No other dwarf will pick it up. |
| `in_progress` | The dwarf is actively working — moving to the site or performing the action. |
| `completed` | Work done. Effects applied (tile changed, item created, need restored). |
| `failed` | Dwarf died, path blocked, materials gone. Returns to `pending` or gets cancelled. |
| `cancelled` | Player cancelled the designation, or the task is no longer valid (e.g., tile already mined). |

### State Transitions

- **pending → claimed**: Job-claiming phase assigns a dwarf.
- **claimed → in_progress**: Task-execution phase begins moving the dwarf.
- **in_progress → completed**: Work progress reaches 100%. Effects are applied.
- **in_progress → failed**: Path became impossible, required materials disappeared, or dwarf died. The task returns to `pending` (so another dwarf can pick it up) unless the task itself is invalid, in which case it's cancelled.
- **Any → cancelled**: Player removes the designation, or the sim detects the task is no longer valid.

### Failed Task Recovery

When a task fails:
1. If the task is still valid (tile still exists, materials still needed): reset to `pending`, clear `assigned_dwarf_id`.
2. If the task is invalid (tile already mined by someone else, target destroyed): set to `cancelled`.
3. The dwarf that failed the task becomes idle and enters the job-claiming pool next tick.

---

## Task Types

### Phase 0 — Minimum Playable

These are the only task types needed for the core game loop:

| Task Type | Trigger | Eligible Worker | Work Required | Product |
|-----------|---------|----------------|---------------|---------|
| `mine` | Player designates tile | Dwarf with `mining` skill | 100 base (modified by material hardness and skill) | Tile becomes floor; stone item drops |
| `haul` | Item on ground + stockpile with space | Any idle dwarf | 20 base (it's just walking) | Item moves to stockpile tile |
| `farm_till` | Player designates farm plot on soil | Dwarf with `farming` skill | 60 base | Soil tile marked as tilled |
| `farm_plant` | Tilled plot + seeds in stockpile | Dwarf with `farming` skill | 40 base | Seeds consumed, crop timer starts |
| `farm_harvest` | Crop reaches maturity | Dwarf with `farming` skill | 30 base | Food item created at plot |
| `eat` | Dwarf need_food < threshold | Self only (autonomous) | 10 (quick action) | Food item consumed, need_food += restore amount |
| `drink` | Dwarf need_drink < threshold | Self only (autonomous) | 10 | Drink item consumed, need_drink += restore amount |
| `sleep` | Dwarf need_sleep < threshold | Self only (autonomous) | 600 (~8 in-game hours) | need_sleep restored by 60 |

### Material Hardness Modifiers (Mining)

| Material | Hardness Multiplier | Effective Work |
|----------|-------------------|----------------|
| soil | 0.3 | 30 |
| stone (sedimentary) | 1.0 | 100 |
| stone (igneous/metamorphic) | 1.5 | 150 |
| ore | 1.2 | 120 |
| gem | 1.4 | 140 |

### Skill Speed Modifiers

Work progress per tick = `BASE_WORK_RATE * (1 + skill_level * 0.1)`

At skill level 0: 1.0 work/tick. At skill level 10: 2.0 work/tick. At skill level 20 (legendary): 3.0 work/tick.

A legendary miner excavates 3× faster than a novice. This matters — it's why you care about skill assignments.

---

## Job Claiming Algorithm

The job-claiming phase runs every tick after task execution. It matches idle dwarves to pending tasks.

### Algorithm

```
1. Collect all tasks with status = 'pending'
2. Collect all idle dwarves (alive, no current_task_id, not in tantrum)
3. For each idle dwarf:
   a. Filter tasks to those the dwarf is eligible for
   b. Score each eligible task
   c. Claim the highest-scoring task (greedy)
4. Mark claimed tasks as 'claimed', set assigned_dwarf_id
```

### Eligibility Rules

| Task Type | Eligible If |
|-----------|------------|
| `mine` | Dwarf has `mining` skill (any level) |
| `haul` | Always eligible (every dwarf hauls) |
| `farm_till`, `farm_plant`, `farm_harvest` | Dwarf has `farming` skill |
| `eat` | Only the dwarf whose need triggered it |
| `drink` | Only the dwarf whose need triggered it |
| `sleep` | Only the dwarf whose need triggered it |

### Scoring

```
score = (task.priority * 3) + (dwarf_skill_level * 2) - (distance * 0.5)
```

- **priority**: 1–10. Player-designated tasks default to 5. Autonomous need tasks get priority based on urgency (see below).
- **skill_level**: The dwarf's level in the relevant skill (0–20). Hauling uses 0.
- **distance**: Manhattan distance from dwarf position to task target tile. Closer tasks score higher.

### Autonomous Task Priority

Autonomous tasks (eat/drink/sleep) get priority proportional to how desperate the need is:

```
priority = floor(10 * (1 - need_value / 100))
```

- need_food at 20 → priority 8
- need_food at 5 → priority 10 (maximum urgency)
- need_food at 50 → priority 5

This means a starving dwarf will prioritize eating over a non-urgent dig. But a dwarf who's only slightly hungry will keep mining.

### Tie-Breaking

When two tasks have the same score, prefer the one created first (FIFO). This prevents task starvation where old tasks never get claimed.

---

## Task Execution

The task-execution phase runs every tick for each dwarf with a current task.

### Per-Tick Logic

```
for each dwarf with status='alive' and current_task_id != null:
  task = lookup task by current_task_id

  if task.status == 'claimed':
    set task.status = 'in_progress'

  if dwarf is not at task target tile:
    move one step toward target (BFS pathfinding)
    if no path exists:
      fail the task
    return  // movement is the dwarf's action this tick

  if dwarf is at task target tile:
    work_rate = BASE_WORK_RATE * (1 + skill_level * 0.1)
    task.work_progress += work_rate

    if task.work_progress >= task.work_required:
      complete the task (apply effects)
      award XP to the dwarf
      clear dwarf.current_task_id
```

### Completion Effects

| Task Type | Effects |
|-----------|---------|
| `mine` | Change tile to `constructed_floor`. Create stone `Item` (category=`raw_material`) at tile position. Award mining XP. |
| `haul` | Move item to stockpile position. Award no XP (hauling is menial). |
| `farm_till` | Mark tile as tilled (tile property). Award farming XP. |
| `farm_plant` | Consume seed item. Set crop growth timer on tile. Award farming XP. |
| `farm_harvest` | Create food `Item` at tile position. Reset tile for next planting. Award farming XP. |
| `eat` | Remove food item from stockpile. Restore `need_food` by `FOOD_RESTORE_AMOUNT` (60). |
| `drink` | Remove drink item from stockpile. Restore `need_drink` by `DRINK_RESTORE_AMOUNT` (70). |
| `sleep` | Restore `need_sleep` by `SLEEP_RESTORE_AMOUNT` (60). If sleeping in a bed: no stress. If sleeping on the floor: +5 stress. |

### XP Awards

| Task Type | XP per Completion |
|-----------|------------------|
| `mine` | 15 |
| `farm_till` | 10 |
| `farm_plant` | 10 |
| `farm_harvest` | 10 |
| `haul` | 0 |
| `eat/drink/sleep` | 0 |

---

## Pathfinding

### BFS on the Fortress Grid

Phase 0 uses breadth-first search on the 2D fortress grid. No A*, no flow fields — just BFS. With 7–30 dwarves on the revealed portion of a 512×512 map, this is fine.

### Walkable Tiles

A tile is walkable if:
- `tile_type` is one of: `constructed_floor`, `cavern_floor`, `stair_up`, `stair_down`, `stair_both`, `open_air` (surface level z=0 only)
- `is_mined` is true (the tile has been excavated)

Unwalkable: solid stone, ore, gem, water, magma, constructed walls.

### Movement

Dwarves move **1 tile per tick** (10 tiles/second real-time). At this speed, crossing a 20-tile room takes 2 real seconds — visible but not tedious.

### Z-Level Traversal

Stairs connect z-levels. A stair_up at (x, y, z) connects to a stair_down or stair_both at (x, y, z+1). BFS treats these as adjacent nodes in the graph.

### Path Caching

No caching in Phase 0. BFS runs fresh each tick. If profiling shows this is a bottleneck (unlikely with <30 dwarves), we can add a path cache keyed on (start, goal) that invalidates when tiles change.

---

## Autonomous Behavior

Dwarves interrupt work to survive. This is what makes them feel alive rather than robotic.

### Need Thresholds

| Need | Interrupt Threshold | Behavior |
|------|-------------------|----------|
| `need_food` | < 30 | Drop task, create `eat` task targeting nearest food item |
| `need_drink` | < 30 | Drop task, create `drink` task targeting nearest drink item |
| `need_sleep` | < 20 | Drop task, create `sleep` task targeting nearest bed (or current tile if no bed) |

These thresholds are constants in `shared/src/constants.ts`.

### Interrupt Logic

The need-satisfaction phase runs after needs-decay and before job-claiming:

```
for each alive dwarf:
  if dwarf.need_drink < NEED_INTERRUPT_DRINK:
    if dwarf has a current task that isn't 'eat' or 'drink' or 'sleep':
      return current task to 'pending'
      clear dwarf.current_task_id
    if no pending drink task exists for this dwarf:
      create autonomous 'drink' task

  // same pattern for food, then sleep
  // drink checked first because thirst kills fastest
```

### Desperate State

If no food or drink exists in the fortress when a dwarf tries to satisfy a need:
- The autonomous task is still created but immediately fails (no valid target).
- The dwarf becomes idle with no way to satisfy the need.
- Needs continue to decay. Stress climbs.
- When `need_food` or `need_drink` hits 0: the dwarf dies. Status → `dead`, `cause_of_death` → `starvation`.

This is the core tension: if you haven't set up farming before embark supplies run out, your dwarves die and you watch it happen in the log.

---

## Stress from Unmet Needs

The stress-update phase runs every tick and adjusts stress based on need levels:

### Stress Increase (per tick)

```
stress_delta = 0

// Each critically low need adds stress
for each need in [food, drink, sleep, social, purpose, beauty]:
  if need_value < 20:
    stress_delta += (20 - need_value) * 0.02  // max +0.4/tick per need
  if need_value == 0:
    stress_delta += 0.5  // additional penalty for total deprivation

dwarf.stress_level = clamp(dwarf.stress_level + stress_delta, 0, 100)
```

### Stress Decrease

```
// Satisfied needs reduce stress
if all physical needs (food, drink, sleep) > 50:
  stress_delta -= 0.1  // slow recovery when comfortable

if dwarf just completed a task (purpose boost):
  stress_delta -= 0.3  // brief satisfaction from work
```

At 10 ticks/second, a dwarf with zero food climbs from 0 to tantrum threshold (80) in about 160 seconds (~2.5 real minutes). Enough time to notice and react, but not enough to be casual.

---

## Death

A dwarf dies when:
- `need_food` reaches 0 and stays there for `STARVATION_TICKS` (18,000 ticks = ~10 in-game days)
- `need_drink` reaches 0 and stays there for `DEHYDRATION_TICKS` (9,000 ticks = ~5 in-game days)
- `health` reaches 0 (combat, not in Phase 0)

Death is handled in the task-execution phase:
1. Set `dwarf.status = 'dead'`, `dwarf.died_year = ctx.year`, `dwarf.cause_of_death = 'starvation'`
2. Any task assigned to this dwarf → `failed`
3. Queue a death event for the activity log
4. If all dwarves are dead: fortress falls (queue fortress_fallen event)

---

## Database Schema

### New Table: `tasks`

```sql
create type task_type as enum (
  'mine', 'haul', 'farm_till', 'farm_plant', 'farm_harvest',
  'eat', 'drink', 'sleep'
);

create type task_status as enum (
  'pending', 'claimed', 'in_progress', 'completed', 'failed', 'cancelled'
);

create table tasks (
  id                uuid primary key default uuid_generate_v4(),
  civilization_id   uuid not null references civilizations(id) on delete cascade,
  task_type         task_type not null,
  status            task_status not null default 'pending',
  priority          int not null default 5 check (priority between 1 and 10),
  assigned_dwarf_id uuid references dwarves(id) on delete set null,
  target_x          int,
  target_y          int,
  target_z          int,
  target_item_id    uuid references items(id) on delete set null,
  work_progress     real not null default 0,
  work_required     real not null default 100,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create index tasks_civ_status_idx on tasks(civilization_id, status);
create index tasks_assigned_idx on tasks(assigned_dwarf_id) where assigned_dwarf_id is not null;
```

### New Columns on `dwarves`

```sql
alter table dwarves add column current_task_id uuid references tasks(id) on delete set null;
alter table dwarves add column position_x int not null default 0;
alter table dwarves add column position_y int not null default 0;
alter table dwarves add column position_z int not null default 0;
```

---

## Embark Setup

When a civilization is created (embark), the sim needs to set initial dwarf positions and create starting items:

### Starting Positions

All 7 dwarves spawn at the fortress center on the surface (z=0). The exact starting tile is the center of the revealed surface area.

### Starting Items

| Item | Category | Count | Purpose |
|------|----------|-------|---------|
| Plump helmet spawn | food | 30 | ~15 in-game days of food for 7 dwarves |
| Dwarven ale | drink | 40 | ~10 in-game days of drink for 7 dwarves |
| Plump helmet seed | raw_material | 10 | For first farm |
| Stone pickaxe | tool | 2 | Mining (not consumed, just required) |

With 30 food and 7 dwarves eating, food lasts many in-game days (~38 real minutes per dwarf before the food need hits the interrupt threshold). Drink runs out faster due to the higher decay rate. The player must have farming going before supplies run out.

---

## What "Playable" Looks Like

After this system is implemented, a player can:

1. Start a fortress — 7 dwarves spawn on the surface with embark supplies
2. Designate tiles to dig — miners walk over and excavate them
3. Stone gets hauled to a stockpile area automatically
4. Designate a farm plot on soil — a farmer tills, plants, and harvests
5. Watch dwarves autonomously stop working to eat, drink, and sleep
6. See stress climb when needs go unmet
7. Watch a dwarf die of starvation if food runs out — and feel responsible
8. Read the activity log and understand everything that happened

This is the exact starvation scenario from `docs/CORE_GAME_LOOP.md`. Every milestone checkbox depends on this system working.

---

## Future Extensions (Not Phase 0)

These build on the task system but are explicitly out of scope:

- **Crafting tasks** (brew, cook, smith, engrave, smooth) — same lifecycle, different completion effects
- **Construction tasks** — build walls, doors, furniture from materials
- **Military tasks** — patrol, train, station, attack
- **Hauling optimization** — zone-based stockpile priority, dedicated hauler assignments
- **Task priorities UI** — player adjusts priorities per task type
- **Skill-based task preferences** — dwarves prefer tasks matching their best skills
- **Path caching / flow fields** — optimization if BFS becomes a bottleneck
