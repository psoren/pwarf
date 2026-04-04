# Core Game Loop (Simulation Engine)

> **Status:** Implemented
> **Last verified:** 2026-04-04

## Overview

The simulation runs as a headless Node.js process on the server — completely separate from the React frontend. It has zero browser dependencies. One `SimRunner` instance drives one civilization's simulation in real time.

## Architecture

```
sim/src/
├── index.ts           Entry point (reads env, creates Supabase client, starts runner)
├── sim-runner.ts      Main loop: start/stop/tick, calls phases in order
├── sim-context.ts     SimContext interface (shared state threaded through phases)
├── tick.ts            Phase ordering: runTick, advanceTime, maybeYearRollup
└── phases/
    ├── index.ts              Barrel export
    ├── needs-decay.ts        Phase 1: decrement dwarf needs
    ├── task-execution.ts     Phase 2: advance dwarf jobs
    ├── need-satisfaction.ts  Phase 3: consume food/drink/beds
    ├── stress-update.ts      Phase 4: recalculate stress
    ├── tantrum-check.ts      Phase 5: trigger tantrums
    ├── tantrum-actions.ts    Phase 6: execute tantrum effects
    ├── monster-spawning.ts   Phase 7: spawn new monsters
    ├── monster-pathfinding.ts Phase 8: move monsters
    ├── combat-resolution.ts  Phase 9: resolve fights
    ├── haul-assignment.ts    Phase 10: assign haul tasks
    ├── task-recovery.ts      Phase 11: recover stuck tasks
    ├── auto-cook.ts          Phase 12: auto-create cook tasks
    ├── auto-brew.ts          Phase 13: auto-create brew tasks
    ├── auto-forage.ts        Phase 14: auto-create forage tasks
    ├── job-claiming.ts       Phase 15: assign idle dwarves
    ├── event-firing.ts       Phase 16: write events to DB
    ├── thought-generation.ts Phase 17: generate dwarf thoughts
    └── yearly-rollup.ts      Annual updates (every 36,000 steps)
```

## Tick Rate & Timing

All timing constants live in `shared/src/constants.ts`:

| Constant            | Value  | Meaning                                |
|--------------------|--------|----------------------------------------|
| `STEPS_PER_SECOND` | 10     | Ticks per real-time second             |
| `STEPS_PER_YEAR`   | 36,000 | Ticks per in-game year (1 real hour)   |
| `STEPS_PER_DAY`    | 1,800  | Ticks per in-game day (~3 real min)    |

Derived timings:
- **Tick interval**: 100ms (1000 / STEPS_PER_SECOND)
- **1 in-game day** ≈ 3 real minutes
- **1 in-game year** = 1 real hour
- **Dwarf lifespan (~80 years)** ≈ 80 real hours
- **Average fortress run (20–40 years)** ≈ 20–40 real hours

## SimRunner Lifecycle

### `start(civilizationId)`
1. Initializes `CachedState` (empty arrays — will load from Supabase)
2. Creates `SimContext` with supabase client, civ ID, step/year/day counters, cached state
3. Starts a `setInterval` at 100ms calling `tick()`

### `tick()`
Each tick:
1. Increments `stepCount` and `currentDay`
2. Runs all 17 standard phases in deterministic order
3. If `stepCount % STEPS_PER_YEAR === 0`: increments year, resets day, runs `yearlyRollup`

### `stop()`
1. Clears the interval timer
2. Persists final state (not yet implemented)
3. Process handles SIGINT/SIGTERM for graceful shutdown

## SimContext

The context object flows through every phase function:

```typescript
interface SimContext {
  supabase: SupabaseClient;     // Service-role client for DB access
  civilizationId: string;        // Which civ this sim is driving
  step: number;                  // Monotonic step counter
  year: number;                  // Current in-game year
  day: number;                   // Current day within year
  state: CachedState;            // Mutable cached world state
}
```

### CachedState

```typescript
interface CachedState {
  dwarves: unknown[];       // Dwarf rows from DB (will be typed as Dwarf[])
  items: unknown[];         // Item rows
  structures: unknown[];    // Structure rows
  monsters: unknown[];      // Monster rows
  workOrders: unknown[];    // Pending designations/work orders
  worldEvents: unknown[];   // Events queued this tick for batch write
}
```

The cached state is loaded from Supabase on `start()` and updated incrementally by each phase. This avoids re-querying the DB every tick.

## Phase Execution Order

The phases run in a strict, deterministic order every tick. This ordering matters — later phases depend on state mutations from earlier phases.

### Per-Tick Phases (every 100ms)

1. **Needs Decay** — Decrements each alive dwarf's six need meters (food, drink, sleep, social, purpose, beauty) by small amounts. Rates vary: thirst decays faster than hunger, sleep faster than social.

2. **Task Execution** — Each dwarf with an assigned job advances it by one work step. Handles pathfinding progress, material hauling, skill-based speed modifiers. Completes jobs when progress hits 100%.

3. **Need Satisfaction** — Dwarves near need-satisfying sources (food stockpile, drink barrel, bed, meeting hall) consume the resource and refill the corresponding need. Creates autonomous eat/drink/sleep tasks when needs fall below interrupt thresholds.

4. **Stress Update** — Recalculates stress from: unmet needs (low food = stress), recent negative memories (witnessed death, slept outside), personality traits (high neuroticism = more stress from same stimuli). Positive memories and fulfilled needs reduce stress.

5. **Tantrum Check** — Dwarves with `stress_level >= STRESS_TANTRUM_THRESHOLD` (80) may enter tantrum. Tantrum severity scales with stress. Can cascade ("tantrum spiral").

6. **Tantrum Actions** — Executes tantrum effects: destroy nearby items, attack other dwarves, go berserk. Duration varies by severity (1800–7200 ticks).

7. **Monster Spawning** — Spawns new monsters based on fortress wealth, population, and current year. Higher wealth attracts more dangerous creatures.

8. **Monster Pathfinding** — Active monsters advance one tile toward their target. Behavior determines target selection: `aggressive` → nearest dwarf, `sieging` → fortress entrance, `territorial` → patrol lair area, `hunting` → weakest visible dwarf.

9. **Combat Resolution** — Checks for tile overlap between monsters and dwarves (or military squads). Resolves using attack/defense stats, equipment quality, skill levels, and dice rolls. Applies damage to health, generates wound descriptions, awards combat XP.

10. **Haul Assignment** — Creates haul tasks for loose items on the ground that should be moved to stockpiles.

11. **Task Recovery** — Detects and recovers stuck tasks (e.g., blocked paths, missing materials). Resets failed tasks to pending or cancels invalid ones.

12. **Auto-Cook** — Checks food stock levels and auto-creates cook tasks when supplies are low and raw ingredients are available.

13. **Auto-Brew** — Checks drink stock levels and auto-creates brew tasks when supplies are low and brewable plants are available.

14. **Auto-Forage** — Auto-creates forage tasks when food is scarce and forageable tiles exist nearby.

15. **Job Claiming** — Finds idle dwarves (no current task) and matches them to unclaimed work orders. Matching considers: enabled labors, skill level, proximity to job site, job priority.

16. **Event Firing** — Collects all notable events from this tick and writes them to `world_events` in Supabase. Events include births, deaths, completions, artifact creation, sieges, discoveries.

17. **Thought Generation** — Creates dwarf thoughts and memories based on recent events, surroundings, and need states. These feed into the stress system and activity log.

### Yearly Rollup (every 36,000 steps)

Runs after the standard phases on the tick where `step % STEPS_PER_YEAR === 0`:

- **Aging**: Increment dwarf ages, roll natural death checks for elderly dwarves
- **Skill level-ups**: Convert accumulated XP into skill level increases
- **Immigration wave**: New dwarves arrive based on fortress wealth and fame
- **Faction standing drift**: Relations with external factions shift based on trade, war, and events
- **Disease spread**: Roll for plague outbreaks, spread between tiles
- **Ruin decay**: Abandoned structures lose `remaining_wealth`, `ghost_count` drifts

## Persistence Strategy

The sim uses the **service-role key** (not the anon key) to bypass RLS — it needs to write to all tables for all civilizations it manages.

### Why Batching Is Required

Writing every change on every tick is not viable. At 10 ticks/sec with 30 dwarves, the naive approach generates ~530 DB writes/sec — and during a siege with 50+ entities, that can exceed 1,000 writes/sec. This is problematic for two reasons:

1. **Supabase Realtime limits** — Every DB write to a subscribed table triggers an outbound Realtime message to the frontend. Supabase caps these at 100 msg/sec (Free), 500 (Pro), or 2,500 (Team/Enterprise). A 30-dwarf fortress would saturate the Pro tier on DB writes alone.

2. **Connection pool pressure** — Each PostgREST or direct Postgres call consumes a connection from the pool. Sustained 500+ writes/sec will exhaust the pool on smaller plans (Free: 20 connections, Pro: 60).

### Batched Write Strategy

Instead of writing every tick, the sim accumulates dirty state in memory and flushes to Supabase on a lower-frequency **write cycle**.

| Constant            | Value   | Meaning                                     |
|--------------------|---------|---------------------------------------------|
| `WRITE_INTERVAL`   | 1000ms  | Flush dirty state to Supabase every 1 second |
| `WRITE_TICKS`      | 10      | Number of sim ticks between writes           |

This reduces write volume by ~10x:

| Table           | Per-tick changes | Writes/sec (naive) | Writes/sec (batched) |
|----------------|-----------------|--------------------|--------------------|
| dwarves         | ~30             | ~300               | ~30 (1 bulk upsert) |
| monsters        | ~10             | ~100               | ~10 (1 bulk upsert) |
| structures      | ~5              | ~50                | ~5 (1 bulk upsert)  |
| world_events    | ~2              | ~20                | ~2 (1 bulk insert)  |
| items           | ~5              | ~50                | ~5 (1 bulk upsert)  |
| civilizations   | ~1              | ~10                | ~1 (1 upsert)       |
| **Total**       | **~53**         | **~530**           | **~6 bulk ops**      |

Each bulk operation is a single PostgREST call with an array payload (e.g., `supabase.from('dwarves').upsert(dirtyDwarves)`). Supabase handles bulk upserts efficiently — they translate to a single Postgres `INSERT ... ON CONFLICT` statement regardless of row count.

### Dirty Tracking

The `CachedState` tracks which entities have been modified since the last flush:

```typescript
interface CachedState {
  dwarves: Dwarf[];
  dirtyDwarfIds: Set<string>;    // IDs modified since last write

  items: Item[];
  dirtyItemIds: Set<string>;

  structures: Structure[];
  dirtyStructureIds: Set<string>;

  monsters: Monster[];
  dirtyMonsterIds: Set<string>;

  pendingEvents: WorldEvent[];   // Queued events (always flushed)

  civilizationDirty: boolean;    // Civ stats changed since last write
}
```

Each phase marks entities dirty when it mutates them (e.g., `state.dirtyDwarfIds.add(dwarf.id)` after decrementing a need). The write cycle collects all dirty entities, issues bulk upserts, then clears the dirty sets.

### Write Cycle Implementation

The write cycle runs every `WRITE_INTERVAL` ms as a separate timer (not inside the tick loop):

```typescript
async function flushToSupabase(ctx: SimContext) {
  const { state, supabase } = ctx;

  // Bulk upsert dirty dwarves
  if (state.dirtyDwarfIds.size > 0) {
    const dirty = state.dwarves.filter(d => state.dirtyDwarfIds.has(d.id));
    await supabase.from('dwarves').upsert(dirty);
    state.dirtyDwarfIds.clear();
  }

  // ... same pattern for monsters, items, structures

  // Bulk insert pending events
  if (state.pendingEvents.length > 0) {
    await supabase.from('world_events').insert(state.pendingEvents);
    state.pendingEvents = [];
  }

  // Upsert civ stats
  if (state.civilizationDirty) {
    await supabase.from('civilizations').upsert(ctx.civSnapshot);
    state.civilizationDirty = false;
  }
}
```

### Data Loss Window

With 1-second batching (`WRITE_INTERVAL = 1000ms`) for in-memory snapshots and 2-second DB flushing (`SIM_FLUSH_INTERVAL_MS = 2000ms`), a server crash loses at most **2 seconds** (20 ticks) of progress. This is acceptable — the player won't notice 2 seconds of lost simulation time, and the previous write-every-tick design was solving a problem that didn't need solving at the cost of massive write amplification.

### Frontend Update Rate

Batching also naturally throttles the Realtime update rate to the frontend. The React UI re-renders once per write cycle (~1/sec) instead of 10 times/sec. This is actually better for the player — most state changes (need decay, position updates) are imperceptible at sub-second granularity. The canvas renderer still runs at requestAnimationFrame rate for smooth panning/cursor movement; only the data driving the panels updates at 1 Hz.

For events that need to feel instant (designation acknowledgment, dwarf selection), the frontend can optimistically update local state before the next Realtime push confirms it.

## Session Lifecycle

1. Player opens the game → frontend authenticates via Supabase Auth
2. Server detects active session → starts a `SimRunner` for that player's active civilization
3. Sim runs continuously while the player is connected
4. Player closes the game → sim calls `stop()`, persists final state, process can idle or shut down
5. Next session → sim loads persisted state and resumes from where it left off

No sim runs while the player is offline. Time does not advance. This is intentional — like actual Dwarf Fortress, you play in real time when you're at the keyboard.
