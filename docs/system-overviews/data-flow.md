# Data Flow

How state moves through the system: sim engine, persistence, database sync, and UI.

## Architecture Overview

Monorepo with three workspaces: **app/** (React/Vite), **sim/** (simulation engine), **shared/** (types/constants). Database is **Supabase PostgreSQL**.

## Sim Engine

The sim runs a **tick loop at 10 Hz** (100ms per tick). Each tick executes 18 phases in order:

1. Needs decay (food, drink, sleep drain per tick)
2. Task execution (dwarves move to tasks, do work)
3. Need satisfaction (eat/drink/sleep if critical)
4. Stress update
5. Tantrum check
6. Tantrum actions
7. Monster spawning
8. Monster pathfinding
9. Combat resolution
10. Expedition tick
11. Haul assignment
12. Task recovery
13. Auto-cook
14. Auto-brew
15. Auto-forage
16. Job claiming (assign idle dwarves to tasks)
17. Event firing
18. Thought generation

All state lives in a **`CachedState` object in memory** with dirty-tracking sets (`dirtyDwarfIds`, `dirtyTaskIds`, etc.). Phases mutate this directly.

Key files:
- `sim/src/sim-runner.ts` — Main tick loop
- `sim/src/sim-context.ts` — In-memory state structure
- `sim/src/phases/*.ts` — Individual phases

## State Persistence (Flush/Load)

- **Load** (`sim/src/load-state.ts`): On start, parallel-fetches dwarves, items, structures, monsters, tasks, and skills from Supabase into `CachedState`.
- **Flush** (`sim/src/flush-state.ts`): Every **2 seconds** (`SIM_FLUSH_INTERVAL_MS = 2000`), upserts only dirty entities to Supabase, inserts pending events, polls for new player-created tasks, then clears dirty sets.

The sim is the source of truth while running; the DB is the durable store.

## App <-> Sim Communication

The sim runs **in-process** (not a web worker). The React hook `useSimRunner` creates a `SimRunner`, starts it, and registers an `onTick` callback that emits a `SimSnapshot` (dwarves, tasks, events) to the UI every tick.

The app **also polls Supabase** on intervals (dwarves/tasks every 2s, events/tiles every 3s) as a fallback. It prefers the live snapshot when available, falling back to polled data when the sim isn't running (e.g., fresh page load).

Key files:
- `app/src/hooks/useSimRunner.ts` — React hook to start/stop sim
- `app/src/hooks/useDwarves.ts` — Dwarf polling
- `app/src/hooks/useTasks.ts` — Task polling + optimistic UI
- `app/src/hooks/useWorldState.ts` — World/civ lifecycle

## Player Input -> Sim

When a player designates an area (e.g., "mine here"):

1. **Optimistic UI** — blueprints show immediately
2. **Insert to DB** — tasks written directly to Supabase `tasks` table
3. **Sim polls** — next flush cycle (<=2s), sim picks up new pending tasks
4. **Job claiming phase** — dwarves score and claim tasks
5. **Task execution** — dwarf pathfinds, does work, completes it
6. **Flush** — results (mined tiles, moved items) written back to DB
7. **Frontend polls** — UI sees the updated state

Key files:
- `app/src/hooks/useDesignation.ts` — Player designations

## Tile Generation (Procedural + Override)

Tiles are **lazily derived** from a world seed using deterministic PRNG — no pre-computation, no DB hit for unexplored tiles. When a tile gets modified (mined, built on), the override goes to `fortress_tiles` or `world_tiles` in the DB. The UI merges: `override ?? derived`.

Key files:
- `app/src/hooks/useFortressTiles.ts` — Fortress tile derivation + DB overrides
- `app/src/hooks/useWorldTiles.ts` — World tile derivation + DB overrides

## Data Flow Diagram

```
User clicks "Mine"
  -> Insert tasks to Supabase
  -> Optimistic UI update

Sim tick loop (10 Hz, in-memory)
  -> Phases mutate CachedState
  -> Dirty-track changed entities

Every 2s: Flush
  -> Upsert dirty entities to Supabase
  -> Poll for new player tasks
  -> Clear dirty sets

Frontend polling (2-3s intervals)
  -> Query Supabase for latest state
  -> Merge with live snapshot
  -> React re-render
```

## Key Constants

| Constant | Value | Notes |
|---|---|---|
| `STEPS_PER_SECOND` | 10 | Tick rate |
| `STEPS_PER_YEAR` | 36,000 | ~1 real-time hour per in-game year |
| `SIM_FLUSH_INTERVAL_MS` | 2,000 | How often dirty state writes to DB |
| `POLL_DWARVES_MS` | 2,000 | Frontend polling interval |
| `POLL_TASKS_MS` | 2,000 | Frontend polling interval |
| `POLL_EVENTS_MS` | 3,000 | Frontend polling interval |
| `POLL_FORTRESS_TILES_MS` | 3,000 | Frontend polling interval |
