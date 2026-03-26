# Data Flow & Persistence

> **Status:** Implemented
> **Last verified:** 2026-03-25

## Overview

The architecture enforces a strict separation: the sim engine writes state to Supabase, and the frontend reads it via Supabase Realtime subscriptions. There is no direct communication between sim and frontend.

## Data Flow

```
┌──────────────┐    writes     ┌──────────────┐    realtime    ┌──────────────┐
│              │──────────────>│              │───────────────>│              │
│  Sim Engine  │               │   Supabase   │               │   Frontend   │
│  (Node.js)   │               │  (Postgres)  │               │   (React)    │
│              │<──────────────│              │<───────────────│              │
└──────────────┘    reads      └──────────────┘   player cmds  └──────────────┘
```

### Sim → Supabase (Write Path)

The sim uses a **service-role key** to bypass RLS. It accumulates dirty state in memory and flushes to Supabase in bulk every 1 second (every 10 ticks):
- Dwarf position, needs, stress, health, current task → bulk upsert
- Monster position and behavior → bulk upsert
- Structure build progress → bulk upsert
- World events (births, deaths, combat, etc.) → bulk insert
- Civilization stats (population, wealth) → single upsert

This batching reduces ~530 individual writes/sec down to ~6 bulk operations/sec, keeping well within Supabase Realtime and connection pool limits. If the server crashes, at most 1 second of progress is lost. See `02-core-game-loop.md` for the full write strategy.

### Supabase → Frontend (Read Path)

The frontend uses the **anon key** with Supabase Realtime to subscribe to table changes:
- `dwarves` — roster updates, need bars, stress colors
- `world_events` — activity log feed
- `civilizations` — toolbar stats (year, pop, wealth)
- `structures` — build progress
- `monsters` — threat indicators

The frontend never polls. It receives push notifications via Realtime channels.

### Frontend → Supabase (Command Path)

Player actions write directly to Supabase through RLS-protected operations:
- Designate tiles (dig, build, stockpile zones)
- Assign labors per dwarf
- Set work orders (craft queue)
- Manage stockpile categories
- Set military squads and patrol routes

These writes go through RLS policies that verify `player_id = auth.uid()`. The sim reads these on the next tick and incorporates them into the simulation.

## Supabase Client Configuration

### Sim (`sim/src/index.ts`)

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
```

- Service role key — full access, bypasses RLS
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`

### Frontend (`app/src/lib/supabase.ts`)

```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- Anon key — subject to RLS policies
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Row Level Security

RLS is enabled on all tables. Key policies:

| Table           | Policy                                                      |
|----------------|-------------------------------------------------------------|
| `worlds`       | Public read where `is_public = true`                        |
| `ruins`        | Public read (all ruins are browsable)                       |
| `world_events` | Public read                                                 |
| `civilizations`| Full access where `player_id = auth.uid()`                  |
| `dwarves`      | Full access where civ's `player_id = auth.uid()`            |
| `expeditions`  | Full access where `player_id = auth.uid()`                  |
| `expeditions`  | Insert blocked if ruin belongs to player's own civ          |
| `players`      | Read/update own profile only                                |

The "players cannot expedition own ruins" policy prevents farming your own deaths for loot.

## State Recovery

If the sim process crashes and restarts:
1. Load the civilization's current state from Supabase (dwarves, items, structures, monsters)
2. Determine the last step from the most recent world event or civilization `updated_at`
3. Resume the tick loop from that point

Since state is flushed every 2 seconds (`SIM_FLUSH_INTERVAL_MS = 2000`), recovery loses at most 20 ticks — imperceptible to the player.

## Shared Types

All TypeScript types for DB rows live in `shared/src/db-types.ts`. Both the sim and frontend import from `@pwarf/shared`. This ensures type consistency across the boundary — if a column changes, both sides see the change at compile time.
